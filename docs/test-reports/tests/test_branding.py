"""
PRJ-LITE999-T-010 测试用例
品牌定制化配置系统：Logo/色彩/文案动态替换

覆盖：数据模型 (UT)、主题 (UT)、渲染器 (UT)、加载器 (UT)、集成 (IT)、边界 (ET)
"""

import json
import asyncio
import threading
from pathlib import Path

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.branding.config import (
    BrandConfig, LogoConfig, ColorScheme, CopyConfig,
    ValidationError, ThemeNotFoundError, ConfigLoadError,
    validate_color,
)
from src.branding.theme import BrandTheme, PRESET_THEMES
from src.branding.renderer import BrandRenderer
from src.branding.loader import BrandConfigLoader


# ============================================================
# UT-001 ~ UT-011: BrandConfig 数据模型
# ============================================================

class TestBrandConfig:

    def test_ut001_default_config(self):
        """UT-001: 默认配置完整性"""
        cfg = BrandConfig()
        assert cfg.logo.fallback_url != ""
        assert cfg.colors.primary != ""
        assert cfg.colors.background != ""
        assert cfg.copy.app_name == "MyApp"
        assert cfg.theme_name == "default"

    def test_ut002_custom_override(self):
        """UT-002: 自定义配置覆盖默认值"""
        cfg = BrandConfig(
            copy=CopyConfig(app_name="BrandX", slogan="We rock"),
            colors=ColorScheme(primary="#ff0000"),
        )
        assert cfg.copy.app_name == "BrandX"
        assert cfg.copy.slogan == "We rock"
        assert cfg.colors.primary == "#ff0000"
        # 未覆盖的保持默认
        assert cfg.colors.background == "#ffffff"

    def test_ut003_logo_url(self):
        """UT-003: Logo URL 配置存取"""
        logo = LogoConfig(url="https://brand.com/logo.png")
        assert logo.url == "https://brand.com/logo.png"
        assert logo.get_effective_url() == "https://brand.com/logo.png"

    def test_ut004_logo_size_valid(self):
        """UT-004: Logo 尺寸合法值"""
        logo = LogoConfig(width=200, height=100)
        logo.validate()  # 不抛异常
        assert logo.width == 200

    def test_ut004_logo_size_invalid(self):
        """UT-004b: Logo 尺寸非法"""
        logo = LogoConfig(width=-1)
        with pytest.raises(ValidationError):
            logo.validate()

    def test_ut005_color_hex_valid(self):
        """UT-005: HEX 色彩校验"""
        assert validate_color("#FF0000") == "#ff0000"
        assert validate_color("#abc") == "#aabbcc"
        assert validate_color("#4A90D9") == "#4a90d9"

    def test_ut006_color_rgb_valid(self):
        """UT-006: RGB 格式解析"""
        assert validate_color("rgb(255, 0, 0)") == "#ff0000"
        assert validate_color("rgb(0, 128, 255)") == "#0080ff"

    def test_ut007_color_invalid(self):
        """UT-007: 非法色彩值拒绝"""
        with pytest.raises(ValidationError):
            validate_color("not-a-color", "test")
        with pytest.raises(ValidationError):
            validate_color("#GGHHII", "test")
        with pytest.raises(ValidationError):
            validate_color("rgb(300, 0, 0)", "test")

    def test_ut008_copy_basic(self):
        """UT-008: 文案基础字段"""
        copy_cfg = CopyConfig(
            app_name="MyCorp", slogan="Innovation first", footer="© 2025"
        )
        assert copy_cfg.app_name == "MyCorp"
        assert copy_cfg.slogan == "Innovation first"
        assert copy_cfg.footer == "© 2025"

    def test_ut009_copy_custom_dict(self):
        """UT-009: 文案自定义字典"""
        copy_cfg = CopyConfig(custom={"welcome": "Hello!", "cta": "Try now"})
        assert copy_cfg.custom["welcome"] == "Hello!"
        assert copy_cfg.custom["cta"] == "Try now"

    def test_ut010_to_dict(self):
        """UT-010: 导出为 dict"""
        cfg = BrandConfig()
        d = cfg.to_dict()
        assert isinstance(d, dict)
        assert "logo" in d
        assert "colors" in d
        assert "copy" in d
        assert d["copy"]["app_name"] == "MyApp"

    def test_ut011_to_json(self):
        """UT-011: 导出为 JSON"""
        cfg = BrandConfig(copy=CopyConfig(app_name="TestApp"))
        j = cfg.to_json()
        parsed = json.loads(j)
        assert parsed["copy"]["app_name"] == "TestApp"


# ============================================================
# UT-012 ~ UT-017: BrandTheme 主题
# ============================================================

class TestBrandTheme:

    def test_ut012_preset_default(self):
        """UT-012: 预设主题 default"""
        tm = BrandTheme()
        data = tm.get_theme_data("default")
        assert "colors" in data
        assert data["colors"]["primary"] == "#4a90d9"

    def test_ut013_preset_dark(self):
        """UT-013: 预设主题 dark"""
        tm = BrandTheme()
        data = tm.get_theme_data("dark")
        assert data["colors"]["background"] == "#1a1a2e"
        assert data["colors"]["text"] == "#e0e0e0"

    def test_ut014_preset_light(self):
        """UT-014: 预设主题 light"""
        tm = BrandTheme()
        data = tm.get_theme_data("light")
        assert data["colors"]["background"] == "#f8f9fa"

    def test_ut015_theme_inherit_override(self):
        """UT-015: 主题继承 + 覆盖"""
        tm = BrandTheme()
        inherited = tm.create_inherited_theme(
            "custom_dark", "dark", {"colors": {"primary": "#00ff00"}}
        )
        assert inherited["colors"]["primary"] == "#00ff00"
        # 其他字段继承 dark
        assert inherited["colors"]["background"] == "#1a1a2e"

        # 验证已注册
        data = tm.get_theme_data("custom_dark")
        assert data["colors"]["primary"] == "#00ff00"

    def test_ut016_theme_not_found(self):
        """UT-016: 不存在的主题"""
        tm = BrandTheme()
        with pytest.raises(ThemeNotFoundError):
            tm.get_theme_data("nonexistent_theme")

    def test_ut017_color_auto_derive(self):
        """UT-017: 色彩自动派生 hover/disabled"""
        cs = ColorScheme(primary="#4a90d9")
        cs.validate()
        hover = cs.derive_hover()
        disabled = cs.derive_disabled()
        # hover 比原色亮
        assert hover != cs.primary
        assert hover.startswith("#")
        # disabled 比原色暗
        assert disabled != cs.primary
        assert disabled.startswith("#")

    def test_list_themes(self):
        """列出所有主题"""
        tm = BrandTheme()
        themes = tm.list_themes()
        assert "default" in themes
        assert "dark" in themes
        assert "light" in themes

    def test_apply_theme(self):
        """应用主题到配置"""
        tm = BrandTheme()
        cfg = BrandConfig()
        dark_cfg = tm.apply_theme(cfg, "dark")
        assert dark_cfg.colors.background == "#1a1a2e"
        assert dark_cfg.theme_name == "dark"
        # 原配置不变
        assert cfg.colors.background == "#ffffff"


# ============================================================
# UT-018 ~ UT-024: BrandRenderer 渲染
# ============================================================

class TestBrandRenderer:

    def _make_renderer(self, **copy_kwargs) -> BrandRenderer:
        copy_cfg = CopyConfig(
            app_name="TestBrand",
            slogan="Best platform",
            footer="© 2025 TestBrand",
            **copy_kwargs,
        )
        cfg = BrandConfig(
            copy=copy_cfg,
            colors=ColorScheme(primary="#ff0000"),
            logo=LogoConfig(url="https://cdn.test.com/logo.png"),
        )
        return BrandRenderer(cfg)

    def test_ut018_simple_replacement(self):
        """UT-018: 单变量替换"""
        r = self._make_renderer()
        result = r.render_text("Welcome to {{brand.name}}")
        assert result == "Welcome to TestBrand"

    def test_ut019_multi_variable(self):
        """UT-019: 多变量替换"""
        r = self._make_renderer()
        result = r.render_text("{{brand.name}} - {{brand.slogan}}")
        assert result == "TestBrand - Best platform"

    def test_ut020_unknown_variable_preserved(self):
        """UT-020: 未知变量保留原文"""
        r = self._make_renderer()
        result = r.render_text("Hello {{brand.unknown_field}}")
        assert "{{brand.unknown_field}}" in result

    def test_ut021_nested_variable(self):
        """UT-021: 嵌套自定义变量"""
        r = self._make_renderer(custom={"welcome": "Hello World!", "cta": "Sign Up"})
        result = r.render_text("{{brand.copy.welcome}} — {{brand.copy.cta}}")
        assert result == "Hello World! — Sign Up"

    def test_ut022_logo_fallback(self):
        """UT-022: Logo URL fallback"""
        # 有 URL 时返回 URL
        r = self._make_renderer()
        assert r.get_logo_url() == "https://cdn.test.com/logo.png"

        # 空 URL 时 fallback
        cfg = BrandConfig(logo=LogoConfig(url=""))
        r2 = BrandRenderer(cfg)
        assert r2.get_logo_url() == "https://default.example.com/logo.png"

    def test_ut023_css_var_output(self):
        """UT-023: CSS var 格式"""
        r = self._make_renderer()
        assert r.get_color_css_var("primary") == "var(--brand-primary)"
        assert r.get_color_css_var("background") == "var(--brand-background)"

    def test_ut024_hex_normalized(self):
        """UT-024: HEX 标准化小写"""
        cfg = BrandConfig(colors=ColorScheme(primary="#FF0000"))
        r = BrandRenderer(cfg)
        assert r.get_color_hex("primary") == "#ff0000"

    def test_css_variables_dict(self):
        """CSS 变量字典生成"""
        r = self._make_renderer()
        css_vars = r.get_css_variables()
        assert "--brand-primary" in css_vars
        assert "--brand-hover" in css_vars
        assert "--brand-disabled" in css_vars

    def test_update_config(self):
        """热更新配置"""
        r = self._make_renderer()
        assert r.render_text("{{brand.name}}") == "TestBrand"

        new_cfg = BrandConfig(copy=CopyConfig(app_name="NewBrand"))
        r.update_config(new_cfg)
        assert r.render_text("{{brand.name}}") == "NewBrand"


# ============================================================
# UT-025 ~ UT-030: BrandConfigLoader
# ============================================================

class TestBrandConfigLoader:

    def test_ut025_from_dict(self):
        """UT-025: 从 dict 加载"""
        loader = BrandConfigLoader()
        cfg = loader.from_dict({
            "copy": {"app_name": "DictBrand"},
            "colors": {"primary": "#00ff00"},
        })
        assert cfg.copy.app_name == "DictBrand"
        assert cfg.colors.primary == "#00ff00"

    def test_ut026_from_json_string(self):
        """UT-026: 从 JSON 字符串加载"""
        loader = BrandConfigLoader()
        j = json.dumps({"copy": {"app_name": "JSONBrand"}})
        cfg = loader.from_json(j)
        assert cfg.copy.app_name == "JSONBrand"

    def test_ut027_from_file(self, tmp_path):
        """UT-027: 从文件加载"""
        f = tmp_path / "brand.json"
        f.write_text(json.dumps({
            "copy": {"app_name": "FileBrand"},
            "colors": {"primary": "#0000ff"},
        }))
        loader = BrandConfigLoader()
        cfg = loader.from_file(f)
        assert cfg.copy.app_name == "FileBrand"
        assert cfg.colors.primary == "#0000ff"

    def test_ut028_multi_layer_merge(self):
        """UT-028: 多层合并 默认→主题→自定义"""
        loader = BrandConfigLoader()
        cfg = loader.load_with_theme(
            theme_name="dark",
            custom_data={"copy": {"app_name": "CustomDark"}},
        )
        # 主题色来自 dark
        assert cfg.colors.background == "#1a1a2e"
        # 自定义覆盖
        assert cfg.copy.app_name == "CustomDark"

    def test_ut029_missing_fields_defaults(self):
        """UT-029: 缺失字段用默认填充"""
        loader = BrandConfigLoader()
        cfg = loader.from_dict({})
        assert cfg.copy.app_name == "MyApp"  # 默认值
        assert cfg.colors.primary == "#4a90d9"

    def test_ut030_invalid_json_file(self, tmp_path):
        """UT-030: 非法 JSON → ConfigLoadError"""
        f = tmp_path / "bad.json"
        f.write_text("not { valid json")
        loader = BrandConfigLoader()
        with pytest.raises(ConfigLoadError):
            loader.from_file(f)

    def test_from_nonexistent_file(self):
        """不存在的文件 → ConfigLoadError"""
        loader = BrandConfigLoader()
        with pytest.raises(ConfigLoadError):
            loader.from_file("/nonexistent/brand.json")

    def test_from_invalid_json_string(self):
        """非法 JSON 字符串"""
        loader = BrandConfigLoader()
        with pytest.raises(ConfigLoadError):
            loader.from_json("{broken")


# ============================================================
# IT-001 ~ IT-004: 集成测试
# ============================================================

class TestIntegration:

    def test_it001_full_pipeline(self, tmp_path):
        """IT-001: 完整流程 加载→合并→渲染"""
        # 写入配置文件
        f = tmp_path / "brand.json"
        f.write_text(json.dumps({
            "copy": {
                "app_name": "SuperApp",
                "slogan": "Build faster",
                "custom": {"hero_title": "Welcome aboard"},
            },
            "colors": {"primary": "#e74c3c"},
            "logo": {"url": "https://cdn.super.com/logo.svg"},
        }))

        # 加载
        loader = BrandConfigLoader()
        cfg = loader.from_file(f)
        cfg.validate()

        # 渲染
        renderer = BrandRenderer(cfg)
        text = renderer.render_text(
            "{{brand.name}}: {{brand.slogan}} | {{brand.copy.hero_title}}"
        )
        assert text == "SuperApp: Build faster | Welcome aboard"
        assert renderer.get_logo_url() == "https://cdn.super.com/logo.svg"
        assert renderer.get_color_hex("primary") == "#e74c3c"

    def test_it002_theme_switch_changes_render(self):
        """IT-002: 主题切换后渲染变化"""
        tm = BrandTheme()
        loader = BrandConfigLoader(theme_manager=tm)

        cfg_default = loader.load_with_theme(theme_name="default")
        cfg_dark = loader.load_with_theme(theme_name="dark")

        r_default = BrandRenderer(cfg_default)
        r_dark = BrandRenderer(cfg_dark)

        assert r_default.get_color_hex("background") == "#ffffff"
        assert r_dark.get_color_hex("background") == "#1a1a2e"

    def test_it003_multi_tenant_isolation(self):
        """IT-003: 多租户品牌隔离"""
        loader = BrandConfigLoader()

        tenant_a = loader.from_dict({
            "copy": {"app_name": "TenantA"},
            "colors": {"primary": "#aa0000"},
        })
        tenant_b = loader.from_dict({
            "copy": {"app_name": "TenantB"},
            "colors": {"primary": "#00bb00"},
        })

        ra = BrandRenderer(tenant_a)
        rb = BrandRenderer(tenant_b)

        assert ra.render_text("{{brand.name}}") == "TenantA"
        assert rb.render_text("{{brand.name}}") == "TenantB"
        assert ra.get_color_hex("primary") == "#aa0000"
        assert rb.get_color_hex("primary") == "#00bb00"

        # 修改 A 不影响 B
        tenant_a.copy.app_name = "TenantA_v2"
        assert ra.render_text("{{brand.name}}") == "TenantA_v2"
        assert rb.render_text("{{brand.name}}") == "TenantB"

    def test_it004_hot_update(self):
        """IT-004: 配置热更新后渲染使用新值"""
        cfg = BrandConfig(copy=CopyConfig(app_name="OldName"))
        renderer = BrandRenderer(cfg)
        assert renderer.render_text("{{brand.name}}") == "OldName"

        new_cfg = BrandConfig(copy=CopyConfig(app_name="NewName"))
        renderer.update_config(new_cfg)
        assert renderer.render_text("{{brand.name}}") == "NewName"


# ============================================================
# ET-001 ~ ET-006: 边界/异常测试
# ============================================================

class TestEdgeCases:

    def test_et001_empty_config(self):
        """ET-001: 空配置 → 全部使用默认"""
        cfg = BrandConfig()
        cfg.validate()  # 不抛异常
        assert cfg.copy.app_name == "MyApp"
        assert cfg.colors.primary == "#4a90d9"

    def test_et002_empty_logo_url(self):
        """ET-002: Logo URL 空 → fallback"""
        cfg = BrandConfig(logo=LogoConfig(url=""))
        renderer = BrandRenderer(cfg)
        assert renderer.get_logo_url() == "https://default.example.com/logo.png"

    def test_et003_empty_color_string(self):
        """ET-003: 色彩空字符串 → 保留空（由上层 fallback）"""
        result = validate_color("")
        assert result == ""

    def test_et004_very_long_brand_name(self):
        """ET-004: 超长品牌名称 10000 字"""
        long_name = "X" * 10000
        cfg = BrandConfig(copy=CopyConfig(app_name=long_name))
        renderer = BrandRenderer(cfg)
        result = renderer.render_text("Brand: {{brand.name}}")
        assert len(result) == len("Brand: ") + 10000

    def test_et005_special_chars(self):
        """ET-005: HTML/JS 特殊字符"""
        cfg = BrandConfig(copy=CopyConfig(
            app_name='<script>alert("xss")</script>',
            slogan='He said "hello" & goodbye',
        ))
        renderer = BrandRenderer(cfg)
        result = renderer.render_text("{{brand.name}} — {{brand.slogan}}")
        assert '<script>' in result  # 原样输出，不转义（由前端负责）
        assert '"hello"' in result

    def test_et006_concurrent_reads(self):
        """ET-006: 并发读取配置 — 线程安全"""
        cfg = BrandConfig(copy=CopyConfig(app_name="ConcurrentBrand"))
        renderer = BrandRenderer(cfg)
        results = []
        errors = []

        def reader():
            try:
                for _ in range(100):
                    text = renderer.render_text("{{brand.name}}")
                    results.append(text)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=reader) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(results) == 1000
        assert all(r == "ConcurrentBrand" for r in results)

    def test_template_with_no_variables(self):
        """无变量的模板 → 原样返回"""
        cfg = BrandConfig()
        renderer = BrandRenderer(cfg)
        assert renderer.render_text("Plain text") == "Plain text"

    def test_template_with_spaces_in_braces(self):
        """变量花括号内有空格"""
        cfg = BrandConfig(copy=CopyConfig(app_name="SpaceBrand"))
        renderer = BrandRenderer(cfg)
        result = renderer.render_text("{{ brand.name }}")
        assert result == "SpaceBrand"

    def test_color_variable_in_template(self):
        """模板中使用色彩变量"""
        cfg = BrandConfig(colors=ColorScheme(primary="#e74c3c"))
        cfg.colors.validate()
        renderer = BrandRenderer(cfg)
        result = renderer.render_text("Color: {{brand.color.primary}}")
        assert result == "Color: #e74c3c"
