"""
PRJ-LITE999-T-010: 品牌动态渲染器
"""

import re
from src.branding.config import BrandConfig, validate_color


# 模板变量匹配 {{brand.xxx}} 或 {{brand.xxx.yyy}}
TEMPLATE_PATTERN = re.compile(r"\{\{\s*brand\.([a-zA-Z0-9_.]+)\s*\}\}")


class BrandRenderer:
    """品牌内容渲染器 — 模板变量替换、Logo 解析、色彩输出"""

    def __init__(self, config: BrandConfig):
        self.config = config

    def update_config(self, config: BrandConfig) -> None:
        """热更新配置"""
        self.config = config

    # ---- 文案渲染 ----

    def render_text(self, template: str) -> str:
        """
        替换模板中的品牌变量:
            {{brand.name}}       → config.copy.app_name
            {{brand.slogan}}     → config.copy.slogan
            {{brand.footer}}     → config.copy.footer
            {{brand.copy.KEY}}   → config.copy.custom[KEY]
            {{brand.unknown}}    → 保留原文
        """
        def replacer(match: re.Match) -> str:
            path = match.group(1)
            value = self._resolve_variable(path)
            if value is not None:
                return value
            # 未知变量：保留原文
            return match.group(0)

        return TEMPLATE_PATTERN.sub(replacer, template)

    def _resolve_variable(self, path: str) -> str | None:
        """解析变量路径"""
        # 直接映射
        simple_map = {
            "name": self.config.copy.app_name,
            "slogan": self.config.copy.slogan,
            "footer": self.config.copy.footer,
        }
        if path in simple_map:
            return simple_map[path]

        # 嵌套: copy.xxx
        if path.startswith("copy."):
            key = path[5:]
            return self.config.copy.custom.get(key)

        # 色彩: color.xxx
        if path.startswith("color."):
            attr = path[6:]
            if hasattr(self.config.colors, attr):
                return getattr(self.config.colors, attr)

        return None

    # ---- Logo ----

    def get_logo_url(self) -> str:
        """获取有效 Logo URL（含 fallback）"""
        return self.config.logo.get_effective_url()

    # ---- 色彩输出 ----

    def get_color_hex(self, color_name: str) -> str:
        """获取色彩的 HEX 值（标准化小写）"""
        raw = getattr(self.config.colors, color_name, "")
        if not raw:
            return ""
        return validate_color(raw, color_name)

    def get_color_css_var(self, color_name: str) -> str:
        """获取 CSS 变量格式: var(--brand-{name})"""
        return f"var(--brand-{color_name})"

    def get_css_variables(self) -> dict[str, str]:
        """生成全部 CSS 变量映射"""
        result = {}
        for name in ("primary", "secondary", "background", "text", "accent"):
            val = getattr(self.config.colors, name, "")
            if val:
                result[f"--brand-{name}"] = val
        # 派生色
        result["--brand-hover"] = self.config.colors.derive_hover()
        result["--brand-disabled"] = self.config.colors.derive_disabled()
        return result
