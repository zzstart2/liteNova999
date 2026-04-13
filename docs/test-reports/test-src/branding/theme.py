"""
PRJ-LITE999-T-010: 品牌主题管理
"""

import copy
from src.branding.config import (
    BrandConfig, LogoConfig, ColorScheme, CopyConfig, ThemeNotFoundError,
)


# 预设主题
PRESET_THEMES: dict[str, dict] = {
    "default": {
        "colors": {
            "primary": "#4a90d9",
            "secondary": "#6c757d",
            "background": "#ffffff",
            "text": "#333333",
            "accent": "#ff6b35",
        },
    },
    "dark": {
        "colors": {
            "primary": "#6ea8fe",
            "secondary": "#a0a4a8",
            "background": "#1a1a2e",
            "text": "#e0e0e0",
            "accent": "#ff8c5a",
        },
    },
    "light": {
        "colors": {
            "primary": "#3d7cbf",
            "secondary": "#8e959b",
            "background": "#f8f9fa",
            "text": "#212529",
            "accent": "#e85d2c",
        },
    },
}


class BrandTheme:
    """主题管理器"""

    def __init__(self):
        self._custom_themes: dict[str, dict] = {}

    def register_theme(self, name: str, theme_data: dict) -> None:
        """注册自定义主题"""
        self._custom_themes[name] = theme_data

    def get_theme_data(self, name: str) -> dict:
        """获取主题数据"""
        if name in self._custom_themes:
            return copy.deepcopy(self._custom_themes[name])
        if name in PRESET_THEMES:
            return copy.deepcopy(PRESET_THEMES[name])
        raise ThemeNotFoundError(name)

    def list_themes(self) -> list[str]:
        """列出所有可用主题"""
        all_names = set(PRESET_THEMES.keys()) | set(self._custom_themes.keys())
        return sorted(all_names)

    def apply_theme(self, config: BrandConfig, theme_name: str) -> BrandConfig:
        """
        应用主题到配置（主题为基层，现有配置为覆盖层）
        """
        theme_data = self.get_theme_data(theme_name)
        new_config = copy.deepcopy(config)

        # 应用主题色彩（仅覆盖主题中定义的字段）
        if "colors" in theme_data:
            for k, v in theme_data["colors"].items():
                if hasattr(new_config.colors, k):
                    setattr(new_config.colors, k, v)

        if "copy" in theme_data:
            for k, v in theme_data["copy"].items():
                if hasattr(new_config.copy, k):
                    setattr(new_config.copy, k, v)

        if "logo" in theme_data:
            for k, v in theme_data["logo"].items():
                if hasattr(new_config.logo, k):
                    setattr(new_config.logo, k, v)

        new_config.theme_name = theme_name
        return new_config

    def create_inherited_theme(
        self, name: str, base_theme: str, overrides: dict
    ) -> dict:
        """创建继承主题: 基于 base_theme 覆盖部分字段"""
        base = self.get_theme_data(base_theme)
        # 深度合并
        for section, values in overrides.items():
            if section in base and isinstance(base[section], dict) and isinstance(values, dict):
                base[section].update(values)
            else:
                base[section] = values
        self._custom_themes[name] = base
        return base
