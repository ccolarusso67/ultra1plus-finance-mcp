"""Configuration for the Ultra1Plus Finance MCP Server."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://u1p_finance:changeme@localhost:5432/u1p_finance"

    # MCP Server
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8080
    mcp_api_key: str = "changeme"

    # Server info
    server_name: str = "ultra1plus-finance"
    server_version: str = "0.1.0"

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


settings = Settings()
