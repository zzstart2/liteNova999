"""
PRJ-LITE999-T-011 测试用例
品牌渲染引擎端到端测试

覆盖：主题生命周期 (UT)、渲染器状态 (UT)、配置迁移合并 (UT)、
      模板引擎深度 (UT)、CSS 变量管线 (UT)、多租户场景 (IT)、边界/异常 (ET)
"""

import json
import copy

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.branding.config import (
    BrandConfig, LogoConfig, ColorScheme, CopyConfig,
    ValidationError, ThemeNotFoundError, ConfigLoadError,
    validate_color, hex_to_rgb, adjust_brightness,
)
from src.branding.theme import BrandTheme, PRESET_THEMES
from src.branding.renderer import BrandRenderer
from src.branding.loader import BrandConfigLoader


# ============================================================
# Helpers
# ============================================================

def make_config(**copy_kwargs) -> BrandConfig:
    return BrandConfig(
        copy=CopyConfig(
            app_name=copy_kwargs.get("app_name", "TestApp"),
            slogan=copy_kwargs.get("slogan", "Test slogan"),
            footer=copy_kwargs.get("footer", "© 2026 TestApp"),
            custom=copy_kwargs.get("custom", {}),
        ),
        colors=ColorScheme(primary=copy_kwargs.get("primary", "#4a90d9")),
        logo=LogoConfig(url=copy_kwargs.get("logo_url", "https://cdn.test.com/logo.png")),
    )


def brightness(hex_color: str) -> float:
    """Calculate perceived brightness (0-255) for comparison."""
    r, g, b = hex_to_rgb(validate_color(hex_color))
    return 0.299 * r + 0.587 * g + 0.114 * b


# ============================================================
# UT-001 ~ UT-008: 主题生命周期
# ============================================================

class TestThemeLifecycle:

    def test_ut001_register_custom_theme(self):
        """UT-001: 注册自定义主题 + 列举"""
        tm = BrandTheme()
        tm.register_theme("ocean", {
            "colors": {"primary": "#006994", "background": "#e0f7fa"},
        })
        themes = tm.list_themes()
        assert "ocean" in themes
        assert "default" in themes  # 预设仍在

    def test_ut002_apply_custom_theme(self):
        """UT-002: 应用自定义主题 — 配色正确"""
        tm = BrandTheme()
        tm.register_theme("ocean", {
            "colors": {"primary": "#006994", "background": "#e0f7fa"},
        })
        cfg = BrandConfig()
        result = tm.apply_theme(cfg, "ocean")
        assert result.colors.primary == "#006994"
        assert result.colors.background == "#e0f7fa"
        assert result.theme_name == "ocean"

    def test_ut003_dynamic_theme_switch(self):
        """UT-003: 主题 default→dark 动态切换 — 渲染输出变化"""
        tm = BrandTheme()
        cfg = BrandConfig()

        cfg_default = tm.apply_theme(cfg, "default")
        r = BrandRenderer(cfg_default)
        css_default = r.get_css_variables()

        cfg_dark = tm.apply_theme(cfg, "dark")
        r.update_config(cfg_dark)
        css_dark = r.get_css_variables()

        assert css_default["--brand-background"] != css_dark["--brand-background"]
        assert css_dark["--brand-background"] == "#1a1a2e"

    def test_ut004_two_level_inheritance(self):
        """UT-004: 二级继承 default → brand_a → brand_b"""
        tm = BrandTheme()
        # Level 1: brand_a 继承 default，覆盖 primary
        tm.create_inherited_theme("brand_a", "default", {
            "colors": {"primary": "#aa0000"},
        })
        # Level 2: brand_b 继承 brand_a，覆盖 accent
        tm.create_inherited_theme("brand_b", "brand_a", {
            "colors": {"accent": "#00ff00"},
        })
        data = tm.get_theme_data("brand_b")
        assert data["colors"]["primary"] == "#aa0000"  # 从 brand_a 继承
        assert data["colors"]["accent"] == "#00ff00"   # brand_b 自己的
        assert data["colors"]["background"] == "#ffffff"  # 从 default 继承

    def test_ut005_child_overrides_parent(self):
        """UT-005: 子主题字段覆盖父主题"""
        tm = BrandTheme()
        tm.create_inherited_theme("child", "dark", {
            "colors": {"primary": "#ff00ff", "background": "#000000"},
        })
        data = tm.get_theme_data("child")
        assert data["colors"]["primary"] == "#ff00ff"
        assert data["colors"]["background"] == "#000000"
        # dark 的 text 保留
        assert data["colors"]["text"] == "#e0e0e0"

    def test_ut006_custom_overrides_preset_name(self):
        """UT-006: 自定义主题覆盖预设同名"""
        tm = BrandTheme()
        tm.register_theme("dark", {
            "colors": {"primary": "#custom_dark"},
        })
        data = tm.get_theme_data("dark")
        # 自定义优先
        assert data["colors"]["primary"] == "#custom_dark"

    def test_ut007_nonexistent_theme(self):
        """UT-007: 应用不存在主题 → ThemeNotFoundError"""
        tm = BrandTheme()
        with pytest.raises(ThemeNotFoundError):
            tm.apply_theme(BrandConfig(), "nonexistent_xyz")

    def test_ut008_theme_deepcopy_isolation(self):
        """UT-008: 获取主题数据后修改不影响原主题"""
        tm = BrandTheme()
        data1 = tm.get_theme_data("default")
        data1["colors"]["primary"] = "#modified"

        data2 = tm.get_theme_data("default")
        assert data2["colors"]["primary"] == "#4a90d9"  # 未被修改


# ============================================================
# UT-009 ~ UT-014: 渲染器状态一致性
# ============================================================

class TestRendererState:

    def test_ut009_hot_update(self):
        """UT-009: 热更新后渲染正确"""
        cfg1 = make_config(app_name="OldApp")
        r = BrandRenderer(cfg1)
        assert r.render_text("{{brand.name}}") == "OldApp"

        cfg2 = make_config(app_name="NewApp", slogan="Fresh")
        r.update_config(cfg2)
        assert r.render_text("{{brand.name}}") == "NewApp"
        assert r.render_text("{{brand.slogan}}") == "Fresh"

    def test_ut010_multi_renderer_isolation(self):
        """UT-010: 多渲染器实例独立"""
        r1 = BrandRenderer(make_config(app_name="App1"))
        r2 = BrandRenderer(make_config(app_name="App2"))

        assert r1.render_text("{{brand.name}}") == "App1"
        assert r2.render_text("{{brand.name}}") == "App2"

        # 修改 r1 的配置不影响 r2
        r1.config.copy.app_name = "App1_v2"
        assert r1.render_text("{{brand.name}}") == "App1_v2"
        assert r2.render_text("{{brand.name}}") == "App2"

    def test_ut011_config_reference_mutation(self):
        """UT-011: 配置对象修改反映到渲染"""
        cfg = make_config(app_name="Initial")
        r = BrandRenderer(cfg)
        assert r.render_text("{{brand.name}}") == "Initial"

        # 直接修改配置对象
        cfg.copy.app_name = "Mutated"
        assert r.render_text("{{brand.name}}") == "Mutated"

    def test_ut012_footer_variable(self):
        """UT-012: {{brand.footer}} 正确"""
        cfg = make_config(footer="© 2026 MyCorp")
        r = BrandRenderer(cfg)
        assert r.render_text("{{brand.footer}}") == "© 2026 MyCorp"

    def test_ut013_color_variable_in_template(self):
        """UT-013: {{brand.color.accent}} 解析"""
        cfg = BrandConfig(colors=ColorScheme(accent="#ff6b35"))
        cfg.colors.validate()
        r = BrandRenderer(cfg)
        assert r.render_text("Accent: {{brand.color.accent}}") == "Accent: #ff6b35"

    def test_ut014_undefined_custom_variable(self):
        """UT-014: 未定义的 custom 变量 → 保留原文"""
        cfg = make_config(custom={"defined": "yes"})
        r = BrandRenderer(cfg)
        result = r.render_text("{{brand.copy.defined}} {{brand.copy.undefined}}")
        assert "yes" in result
        assert "{{brand.copy.undefined}}" in result


# ============================================================
# UT-015 ~ UT-020: 配置迁移与增量合并
# ============================================================

class TestConfigMerge:

    def test_ut015_incremental_copy_only(self):
        """UT-015: 增量更新 — 仅更新 copy，colors/logo 不变"""
        cfg = make_config(app_name="Original", primary="#aa0000", logo_url="https://orig.com/l.png")
        cfg.update_from_dict({"copy": {"app_name": "Updated"}})
        assert cfg.copy.app_name == "Updated"
        assert cfg.colors.primary == "#aa0000"  # 未变
        assert cfg.logo.url == "https://orig.com/l.png"  # 未变

    def test_ut016_incremental_colors_only(self):
        """UT-016: 增量更新 — 仅更新 colors"""
        cfg = make_config(app_name="KeepMe", primary="#000000")
        cfg.update_from_dict({"colors": {"primary": "#ff0000"}})
        assert cfg.colors.primary == "#ff0000"
        assert cfg.copy.app_name == "KeepMe"  # 未变

    def test_ut017_multiple_incremental_updates(self):
        """UT-017: 连续多次增量更新叠加"""
        cfg = BrandConfig()
        cfg.update_from_dict({"copy": {"app_name": "Step1"}})
        cfg.update_from_dict({"colors": {"primary": "#111111"}})
        cfg.update_from_dict({"logo": {"url": "https://step3.com/logo.png"}})
        cfg.update_from_dict({"copy": {"slogan": "Step4 slogan"}})

        assert cfg.copy.app_name == "Step1"
        assert cfg.colors.primary == "#111111"
        assert cfg.logo.url == "https://step3.com/logo.png"
        assert cfg.copy.slogan == "Step4 slogan"

    def test_ut018_custom_dict_merge(self):
        """UT-018: custom dict 合并 — 新 key 追加，旧 key 保留"""
        cfg = make_config(custom={"key_a": "val_a", "key_b": "val_b"})
        cfg.update_from_dict({"copy": {"custom": {"key_b": "val_b_new", "key_c": "val_c"}}})

        assert cfg.copy.custom["key_a"] == "val_a"       # 保留
        assert cfg.copy.custom["key_b"] == "val_b_new"   # 更新
        assert cfg.copy.custom["key_c"] == "val_c"       # 追加

    def test_ut019_metadata_merge(self):
        """UT-019: metadata 合并"""
        cfg = BrandConfig(metadata={"env": "prod", "version": "1.0"})
        cfg.update_from_dict({"metadata": {"version": "2.0", "region": "cn"}})

        assert cfg.metadata["env"] == "prod"         # 保留
        assert cfg.metadata["version"] == "2.0"      # 更新
        assert cfg.metadata["region"] == "cn"         # 追加

    def test_ut020_empty_dict_no_change(self):
        """UT-020: update_from_dict 空 dict — 不改变任何值"""
        cfg = make_config(app_name="Stable", primary="#aabbcc")
        original = cfg.to_json()
        cfg.update_from_dict({})
        assert cfg.to_json() == original


# ============================================================
# UT-021 ~ UT-028: 模板引擎深度
# ============================================================

class TestTemplateEngine:

    def _renderer(self, **kw):
        return BrandRenderer(make_config(**kw))

    def test_ut021_repeated_variable(self):
        """UT-021: 同一变量重复 3 次"""
        r = self._renderer(app_name="X")
        result = r.render_text("{{brand.name}} {{brand.name}} {{brand.name}}")
        assert result == "X X X"

    def test_ut022_adjacent_variables(self):
        """UT-022: 连续变量无间隔"""
        r = self._renderer(app_name="A", slogan="B")
        result = r.render_text("{{brand.name}}{{brand.slogan}}")
        assert result == "AB"

    def test_ut023_all_variables_template(self):
        """UT-023: 全变量模板 (无静态文本)"""
        r = self._renderer(app_name="Name", slogan="Slogan", footer="Footer")
        result = r.render_text("{{brand.name}}{{brand.slogan}}{{brand.footer}}")
        assert result == "NameSloganFooter"

    def test_ut024_variable_value_contains_braces(self):
        """UT-024: 变量值含 {{ 字符 — 不触发二次解析"""
        r = self._renderer(app_name="Test{{brand.slogan}}")
        result = r.render_text("{{brand.name}}")
        # 变量值原样输出，不二次替换
        assert result == "Test{{brand.slogan}}"

    def test_ut025_empty_template(self):
        """UT-025: 空模板 → 返回空字符串"""
        r = self._renderer()
        assert r.render_text("") == ""

    def test_ut026_large_template(self):
        """UT-026: 大模板 (10000 字 + 100 变量)"""
        r = self._renderer(app_name="BIG")
        parts = ["Hello world! " * 50]  # ~650 chars
        for i in range(100):
            parts.append(f"Item {i}: {{{{brand.name}}}} ")
        template = "".join(parts)
        result = r.render_text(template)
        assert result.count("BIG") == 100
        assert "{{brand.name}}" not in result

    def test_ut027_html_in_template(self):
        """UT-027: 模板中含 HTML 标签"""
        r = self._renderer(app_name="Corp")
        result = r.render_text('<h1>{{brand.name}}</h1><p class="brand">{{brand.slogan}}</p>')
        assert "<h1>Corp</h1>" in result
        assert '<p class="brand">' in result

    def test_ut028_multiline_template(self):
        """UT-028: 多行模板"""
        r = self._renderer(app_name="Multi", slogan="Line")
        template = """Line 1: {{brand.name}}
Line 2: {{brand.slogan}}
Line 3: end"""
        result = r.render_text(template)
        lines = result.split("\n")
        assert lines[0] == "Line 1: Multi"
        assert lines[1] == "Line 2: Line"
        assert lines[2] == "Line 3: end"


# ============================================================
# UT-029 ~ UT-034: CSS 变量管线
# ============================================================

class TestCSSPipeline:

    def test_ut029_complete_css_variables(self):
        """UT-029: 完整 CSS 变量集 (5色+2派生=7)"""
        cfg = BrandConfig(colors=ColorScheme(
            primary="#4a90d9", secondary="#6c757d",
            background="#ffffff", text="#333333", accent="#ff6b35",
        ))
        cfg.colors.validate()
        r = BrandRenderer(cfg)
        css = r.get_css_variables()

        expected_keys = {
            "--brand-primary", "--brand-secondary", "--brand-background",
            "--brand-text", "--brand-accent", "--brand-hover", "--brand-disabled",
        }
        assert set(css.keys()) == expected_keys

    def test_ut030_theme_switch_css_sync(self):
        """UT-030: 主题切换后 CSS 变量同步"""
        tm = BrandTheme()
        cfg = BrandConfig()

        cfg_light = tm.apply_theme(cfg, "light")
        r = BrandRenderer(cfg_light)
        css_light = r.get_css_variables()

        cfg_dark = tm.apply_theme(cfg, "dark")
        r.update_config(cfg_dark)
        css_dark = r.get_css_variables()

        assert css_light["--brand-background"] != css_dark["--brand-background"]
        assert css_light["--brand-text"] != css_dark["--brand-text"]

    def test_ut031_hover_brighter_than_primary(self):
        """UT-031: hover 比 primary 亮"""
        cfg = BrandConfig(colors=ColorScheme(primary="#4a90d9"))
        cfg.colors.validate()
        r = BrandRenderer(cfg)
        css = r.get_css_variables()

        primary_brightness = brightness(css["--brand-primary"])
        hover_brightness = brightness(css["--brand-hover"])
        assert hover_brightness > primary_brightness

    def test_ut032_disabled_darker_than_primary(self):
        """UT-032: disabled 比 primary 暗"""
        cfg = BrandConfig(colors=ColorScheme(primary="#4a90d9"))
        cfg.colors.validate()
        r = BrandRenderer(cfg)
        css = r.get_css_variables()

        primary_brightness = brightness(css["--brand-primary"])
        disabled_brightness = brightness(css["--brand-disabled"])
        assert disabled_brightness < primary_brightness

    def test_ut033_rgb_input_to_hex_output(self):
        """UT-033: RGB 输入 → validate 后为 HEX"""
        cfg = BrandConfig(colors=ColorScheme(primary="rgb(74, 144, 217)"))
        cfg.colors.validate()
        assert cfg.colors.primary == "#4a90d9"
        r = BrandRenderer(cfg)
        assert r.get_color_hex("primary") == "#4a90d9"

    def test_ut034_short_hex_expansion(self):
        """UT-034: 短 HEX (#abc) 扩展为 #aabbcc"""
        cfg = BrandConfig(colors=ColorScheme(primary="#abc"))
        cfg.colors.validate()
        assert cfg.colors.primary == "#aabbcc"


# ============================================================
# IT-001 ~ IT-005: 多租户场景
# ============================================================

class TestMultiTenantScenarios:

    def test_it001_5_tenants_parallel(self):
        """IT-001: 5 租户并行渲染 — 各自输出正确"""
        loader = BrandConfigLoader()
        renderers = {}

        for i in range(5):
            cfg = loader.from_dict({
                "copy": {"app_name": f"Tenant{i}", "slogan": f"Slogan{i}"},
                "colors": {"primary": f"#{i:02x}{i:02x}{i:02x}"},
            })
            renderers[f"t{i}"] = BrandRenderer(cfg)

        for i in range(5):
            r = renderers[f"t{i}"]
            assert r.render_text("{{brand.name}}") == f"Tenant{i}"
            assert r.render_text("{{brand.slogan}}") == f"Slogan{i}"

    def test_it002_tenant_modification_isolation(self):
        """IT-002: 租户 A 修改不影响租户 B"""
        loader = BrandConfigLoader()
        cfg_a = loader.from_dict({"copy": {"app_name": "A"}})
        cfg_b = loader.from_dict({"copy": {"app_name": "B"}})
        r_a = BrandRenderer(cfg_a)
        r_b = BrandRenderer(cfg_b)

        cfg_a.copy.app_name = "A_modified"
        assert r_a.render_text("{{brand.name}}") == "A_modified"
        assert r_b.render_text("{{brand.name}}") == "B"  # 不受影响

    def test_it003_shared_theme_independent_override(self):
        """IT-003: 租户共享主题但独立覆盖"""
        tm = BrandTheme()
        loader = BrandConfigLoader(theme_manager=tm)

        cfg_a = loader.load_with_theme(
            theme_name="dark",
            custom_data={"copy": {"app_name": "TenantA_Dark"}},
        )
        cfg_b = loader.load_with_theme(
            theme_name="dark",
            custom_data={"copy": {"app_name": "TenantB_Dark"}},
        )

        r_a = BrandRenderer(cfg_a)
        r_b = BrandRenderer(cfg_b)

        # 共享 dark 主题色
        assert r_a.get_color_hex("background") == "#1a1a2e"
        assert r_b.get_color_hex("background") == "#1a1a2e"

        # 各自覆盖
        assert r_a.render_text("{{brand.name}}") == "TenantA_Dark"
        assert r_b.render_text("{{brand.name}}") == "TenantB_Dark"

    def test_it004_full_lifecycle(self):
        """IT-004: 完整生命周期 创建→渲染→更新→切换主题→再渲染"""
        tm = BrandTheme()
        loader = BrandConfigLoader(theme_manager=tm)

        # 1. 创建
        cfg = loader.load_with_theme(
            theme_name="default",
            custom_data={"copy": {"app_name": "Phase1"}},
        )
        r = BrandRenderer(cfg)
        assert r.render_text("{{brand.name}}") == "Phase1"
        assert r.get_color_hex("background") == "#ffffff"

        # 2. 增量更新
        cfg.update_from_dict({"copy": {"app_name": "Phase2", "slogan": "Evolved"}})
        assert r.render_text("{{brand.name}} — {{brand.slogan}}") == "Phase2 — Evolved"

        # 3. 切换主题
        cfg_dark = tm.apply_theme(cfg, "dark")
        r.update_config(cfg_dark)
        assert r.get_color_hex("background") == "#1a1a2e"
        # copy 在主题中没定义，保留自定义值
        assert r.render_text("{{brand.name}}") == "Phase2"

        # 4. 再次更新
        cfg_dark.update_from_dict({"copy": {"app_name": "Phase3"}})
        assert r.render_text("{{brand.name}}") == "Phase3"

    def test_it005_json_load_theme_update_render(self, tmp_path):
        """IT-005: JSON 加载 → 主题应用 → 增量更新 → 渲染 + CSS"""
        f = tmp_path / "brand.json"
        f.write_text(json.dumps({
            "copy": {"app_name": "JSONBrand", "slogan": "Fast", "custom": {"hero": "Welcome"}},
            "colors": {"primary": "#e74c3c"},
            "logo": {"url": "https://json.brand/logo.svg"},
        }))

        tm = BrandTheme()
        loader = BrandConfigLoader(theme_manager=tm)

        # 加载 JSON
        cfg = loader.from_file(f)

        # 应用 dark 主题 (色彩覆盖，文案保留)
        cfg = tm.apply_theme(cfg, "dark")

        # 增量更新
        cfg.update_from_dict({"copy": {"slogan": "Faster"}})

        cfg.validate()
        r = BrandRenderer(cfg)

        # 渲染
        assert r.render_text("{{brand.name}}") == "JSONBrand"
        assert r.render_text("{{brand.slogan}}") == "Faster"
        assert r.render_text("{{brand.copy.hero}}") == "Welcome"

        # Logo (主题没覆盖 logo, 但 apply_theme deepcopy 后 logo.url 被保留)
        # dark 主题只定义了 colors，所以 logo 取 BrandConfig 默认
        # apply_theme 以 cfg 为基础，所以 logo 来自原始 JSON
        assert r.get_logo_url() != ""

        # CSS
        css = r.get_css_variables()
        assert len(css) == 7
        # 色彩来自 dark 主题
        assert css["--brand-background"] == "#1a1a2e"


# ============================================================
# ET-001 ~ ET-004: 边界/异常
# ============================================================

class TestEdgeCases:

    def test_et001_empty_theme_data(self):
        """ET-001: 空主题数据注册 — 不崩溃"""
        tm = BrandTheme()
        tm.register_theme("empty", {})
        cfg = BrandConfig()
        result = tm.apply_theme(cfg, "empty")
        # 色彩保持默认
        assert result.colors.primary == "#4a90d9"

    def test_et002_unknown_fields_ignored(self):
        """ET-002: update_from_dict 含未知字段 — 忽略"""
        cfg = make_config(app_name="Safe")
        cfg.update_from_dict({
            "unknown_section": {"foo": "bar"},
            "copy": {"unknown_field": "ignored"},
        })
        assert cfg.copy.app_name == "Safe"  # 不受影响

    def test_et003_all_rgb_colors(self):
        """ET-003: 色彩全为 RGB 格式 — 全链路正常"""
        cfg = BrandConfig(colors=ColorScheme(
            primary="rgb(74, 144, 217)",
            secondary="rgb(108, 117, 125)",
            background="rgb(255, 255, 255)",
            text="rgb(51, 51, 51)",
            accent="rgb(255, 107, 53)",
        ))
        cfg.colors.validate()

        # 全部转为 HEX
        assert cfg.colors.primary.startswith("#")
        assert cfg.colors.secondary.startswith("#")
        assert cfg.colors.background.startswith("#")
        assert cfg.colors.text.startswith("#")
        assert cfg.colors.accent.startswith("#")

        # CSS 变量正常
        r = BrandRenderer(cfg)
        css = r.get_css_variables()
        assert len(css) == 7
        for v in css.values():
            assert v.startswith("#")

    def test_et004_roundtrip_dict_serialization(self):
        """ET-004: to_dict → from_dict 往返一致"""
        original = BrandConfig(
            copy=CopyConfig(
                app_name="RoundTrip", slogan="Test",
                footer="© 2026", custom={"k1": "v1"},
            ),
            colors=ColorScheme(primary="#aabbcc", accent="#112233"),
            logo=LogoConfig(url="https://rt.com/logo.png", width=200, height=100),
            theme_name="custom",
            metadata={"env": "test"},
        )

        d = original.to_dict()
        loader = BrandConfigLoader()
        restored = loader.from_dict(d)

        # 核心字段一致
        assert restored.copy.app_name == original.copy.app_name
        assert restored.copy.slogan == original.copy.slogan
        assert restored.copy.footer == original.copy.footer
        assert restored.copy.custom == original.copy.custom
        assert restored.colors.primary == original.colors.primary
        assert restored.colors.accent == original.colors.accent
        assert restored.logo.url == original.logo.url
        assert restored.theme_name == original.theme_name
        assert restored.metadata == original.metadata
