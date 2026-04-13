"""
PRJ-LITE999-T-010: 品牌定制化配置 — 数据模型与校验
"""

import json
import re
import copy
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


# ============================================================
# 异常
# ============================================================

class ValidationError(Exception):
    """配置校验错误"""
    def __init__(self, field_name: str, message: str):
        self.field_name = field_name
        super().__init__(f"Validation error on '{field_name}': {message}")


class ThemeNotFoundError(Exception):
    """主题不存在"""
    def __init__(self, theme_name: str):
        self.theme_name = theme_name
        super().__init__(f"Theme '{theme_name}' not found")


class ConfigLoadError(Exception):
    """配置加载失败"""
    def __init__(self, source: str, message: str):
        self.source = source
        super().__init__(f"Failed to load config from '{source}': {message}")


# ============================================================
# 色彩工具
# ============================================================

HEX_PATTERN = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
RGB_PATTERN = re.compile(r"^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$")


def validate_color(value: str, field_name: str = "color") -> str:
    """
    校验并标准化色彩值。
    接受: #RGB, #RRGGBB, rgb(r,g,b)
    返回: 标准化 #rrggbb 小写
    """
    if not value:
        return value  # 允许空值（由上层 fallback）

    value = value.strip()

    # HEX
    m = HEX_PATTERN.match(value)
    if m:
        hex_part = m.group(1).lower()
        if len(hex_part) == 3:
            hex_part = "".join(c * 2 for c in hex_part)
        return f"#{hex_part}"

    # RGB
    m = RGB_PATTERN.match(value)
    if m:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if all(0 <= c <= 255 for c in (r, g, b)):
            return f"#{r:02x}{g:02x}{b:02x}"
        raise ValidationError(field_name, f"RGB values out of range: {value}")

    raise ValidationError(field_name, f"Invalid color format: '{value}'")


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """#rrggbb → (r, g, b)"""
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def adjust_brightness(hex_color: str, factor: float) -> str:
    """调整亮度: factor > 1 变亮, < 1 变暗"""
    r, g, b = hex_to_rgb(hex_color)
    r = min(255, max(0, int(r * factor)))
    g = min(255, max(0, int(g * factor)))
    b = min(255, max(0, int(b * factor)))
    return rgb_to_hex(r, g, b)


# ============================================================
# 数据模型
# ============================================================

@dataclass
class LogoConfig:
    """Logo 配置"""
    url: str = ""
    fallback_url: str = "https://default.example.com/logo.png"
    width: Optional[int] = None   # px, None = auto
    height: Optional[int] = None  # px, None = auto

    def get_effective_url(self) -> str:
        return self.url if self.url else self.fallback_url

    def validate(self) -> None:
        if self.width is not None and self.width <= 0:
            raise ValidationError("logo.width", "Must be positive")
        if self.height is not None and self.height <= 0:
            raise ValidationError("logo.height", "Must be positive")


@dataclass
class ColorScheme:
    """色彩方案"""
    primary: str = "#4a90d9"
    secondary: str = "#6c757d"
    background: str = "#ffffff"
    text: str = "#333333"
    accent: str = "#ff6b35"

    def validate(self) -> None:
        for fname in ("primary", "secondary", "background", "text", "accent"):
            val = getattr(self, fname)
            if val:
                normalized = validate_color(val, f"color.{fname}")
                setattr(self, fname, normalized)

    def derive_hover(self) -> str:
        return adjust_brightness(self.primary, 1.15)

    def derive_disabled(self) -> str:
        return adjust_brightness(self.primary, 0.6)


@dataclass
class CopyConfig:
    """文案配置"""
    app_name: str = "MyApp"
    slogan: str = ""
    footer: str = ""
    custom: dict[str, str] = field(default_factory=dict)


@dataclass
class BrandConfig:
    """品牌完整配置"""
    logo: LogoConfig = field(default_factory=LogoConfig)
    colors: ColorScheme = field(default_factory=ColorScheme)
    copy: CopyConfig = field(default_factory=CopyConfig)
    theme_name: str = "default"
    metadata: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        self.logo.validate()
        self.colors.validate()

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def update_from_dict(self, data: dict) -> None:
        """从字典更新配置（部分更新）"""
        if "logo" in data:
            for k, v in data["logo"].items():
                if hasattr(self.logo, k):
                    setattr(self.logo, k, v)
        if "colors" in data:
            for k, v in data["colors"].items():
                if hasattr(self.colors, k):
                    setattr(self.colors, k, v)
        if "copy" in data:
            for k, v in data["copy"].items():
                if k == "custom" and isinstance(v, dict):
                    self.copy.custom.update(v)
                elif hasattr(self.copy, k):
                    setattr(self.copy, k, v)
        if "theme_name" in data:
            self.theme_name = data["theme_name"]
        if "metadata" in data:
            self.metadata.update(data["metadata"])
