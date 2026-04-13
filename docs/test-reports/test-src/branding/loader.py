"""
PRJ-LITE999-T-010: 品牌配置加载器
"""

import json
import copy
from pathlib import Path
from typing import Any

from src.branding.config import (
    BrandConfig, LogoConfig, ColorScheme, CopyConfig, ConfigLoadError,
)
from src.branding.theme import BrandTheme


class BrandConfigLoader:
    """
    品牌配置加载器

    加载来源: dict / JSON 字符串 / 文件路径
    合并策略: 默认配置 → 主题配置 → 自定义配置
    """

    def __init__(self, theme_manager: BrandTheme | None = None):
        self.theme_manager = theme_manager or BrandTheme()

    def from_dict(self, data: dict) -> BrandConfig:
        """从字典构建 BrandConfig"""
        config = BrandConfig()
        config.update_from_dict(data)
        return config

    def from_json(self, json_str: str) -> BrandConfig:
        """从 JSON 字符串加载"""
        try:
            data = json.loads(json_str)
        except (json.JSONDecodeError, TypeError) as e:
            raise ConfigLoadError("json_string", str(e))
        if not isinstance(data, dict):
            raise ConfigLoadError("json_string", "Root must be a JSON object")
        return self.from_dict(data)

    def from_file(self, file_path: str | Path) -> BrandConfig:
        """从文件加载（JSON）"""
        path = Path(file_path)
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, IOError) as e:
            raise ConfigLoadError(str(path), str(e))
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ConfigLoadError(str(path), f"Invalid JSON: {e}")
        if not isinstance(data, dict):
            raise ConfigLoadError(str(path), "Root must be a JSON object")
        return self.from_dict(data)

    def load_with_theme(
        self,
        custom_data: dict | None = None,
        theme_name: str = "default",
    ) -> BrandConfig:
        """
        多层合并加载:
        1. 创建默认 BrandConfig
        2. 应用主题
        3. 覆盖自定义配置
        """
        # 1. 默认
        config = BrandConfig()

        # 2. 应用主题
        config = self.theme_manager.apply_theme(config, theme_name)

        # 3. 覆盖自定义
        if custom_data:
            config.update_from_dict(custom_data)

        config.validate()
        return config
