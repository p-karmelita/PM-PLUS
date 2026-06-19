"""
Configuration module for PM PLUS Python agents.
Loads configuration from environment variables and agent_config.yaml.
"""

import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent


class AgentConfig:
    """Configuration for a single agent."""
    
    def __init__(self, agent_id: str, api_key: str):
        self.agent_id = agent_id
        self.api_key = api_key
    
    @classmethod
    def from_env(cls, prefix: str) -> 'AgentConfig':
        """Load agent config from environment variables."""
        agent_id = os.getenv(f"{prefix}_AGENT_ID")
        api_key = os.getenv(f"{prefix}_API_KEY")
        
        if not agent_id or not api_key:
            raise ValueError(f"Missing {prefix}_AGENT_ID or {prefix}_API_KEY in environment")
        
        return cls(agent_id=agent_id, api_key=api_key)
    
    @classmethod
    def from_yaml(cls, config_dict: Dict[str, str]) -> 'AgentConfig':
        """Load agent config from YAML dictionary."""
        return cls(
            agent_id=config_dict.get('agent_id', ''),
            api_key=config_dict.get('api_key', '')
        )


class Config:
    """Main configuration class for PM PLUS."""
    
    def __init__(self):
        # API Server
        self.port = int(os.getenv('PORT', '3000'))
        self.state_store_url = os.getenv('STATE_STORE_URL', 'http://localhost:3000')
        
        # Band.ai Platform
        self.band_rest_url = os.getenv('BAND_REST_URL', 'https://app.band.ai/api/v1')
        self.band_ws_url = os.getenv('BAND_WS_URL', 'wss://app.band.ai/api/v1/socket/websocket')
        self.band_api_key = os.getenv('BAND_API_KEY', '')
        
        # Band Rooms
        self.ops_room_id = os.getenv('OPS_ROOM_ID', '')
        self.pm_alerts_room_id = os.getenv('PM_ALERTS_ROOM_ID', '')
        self.reports_room_id = os.getenv('REPORTS_ROOM_ID', '')
        
        # LLM Provider
        self.llm_provider = os.getenv('LLM_PROVIDER', 'aiml')
        self.aiml_api_key = os.getenv('AIML_API_KEY', '')
        self.aiml_model = os.getenv('AIML_MODEL', 'gpt-4o')
        self.featherless_api_key = os.getenv('FEATHERLESS_API_KEY', '')
        self.featherless_model = os.getenv('FEATHERLESS_MODEL', '')
        
        # Load agent configurations
        self._load_agent_configs()
    
    def _load_agent_configs(self):
        """Load agent configurations from environment or YAML file."""
        # Try loading from environment first
        try:
            self.risk_analyzer = AgentConfig.from_env('RISK_ANALYZER')
            self.reporter = AgentConfig.from_env('REPORTER')
            self.resource_balancer = AgentConfig.from_env('RESOURCE_BALANCER')
            return
        except ValueError:
            pass
        
        # Fall back to agent_config.yaml
        config_path = PROJECT_ROOT / 'agent_config.yaml'
        if config_path.exists():
            with open(config_path, 'r') as f:
                yaml_config = yaml.safe_load(f)
            
            self.risk_analyzer = AgentConfig.from_yaml(yaml_config.get('risk_analyzer', {}))
            self.reporter = AgentConfig.from_yaml(yaml_config.get('reporter', {}))
            self.resource_balancer = AgentConfig.from_yaml(yaml_config.get('resource_balancer', {}))
        else:
            raise ValueError(
                "Agent configuration not found. Please set environment variables or create agent_config.yaml"
            )
    
    def get_agent_config(self, agent_name: str) -> AgentConfig:
        """Get configuration for a specific agent."""
        agent_map = {
            'risk_analyzer': self.risk_analyzer,
            'reporter': self.reporter,
            'resource_balancer': self.resource_balancer,
        }
        
        config = agent_map.get(agent_name)
        if not config:
            raise ValueError(f"Unknown agent: {agent_name}")
        
        return config
    
    def validate(self) -> bool:
        """Validate that all required configuration is present."""
        errors = []
        
        # Check Band.ai configuration
        if not self.band_api_key:
            errors.append("BAND_API_KEY is not set")
        
        # Check agent configurations
        for agent_name in ['risk_analyzer', 'reporter', 'resource_balancer']:
            try:
                config = self.get_agent_config(agent_name)
                if not config.agent_id:
                    errors.append(f"{agent_name.upper()}_AGENT_ID is not set")
                if not config.api_key:
                    errors.append(f"{agent_name.upper()}_API_KEY is not set")
            except ValueError as e:
                errors.append(str(e))
        
        # Check LLM configuration
        if self.llm_provider == 'aiml' and not self.aiml_api_key:
            errors.append("AIML_API_KEY is not set (required for LLM provider 'aiml')")
        elif self.llm_provider == 'featherless' and not self.featherless_api_key:
            errors.append("FEATHERLESS_API_KEY is not set (required for LLM provider 'featherless')")
        
        if errors:
            print("Configuration errors:")
            for error in errors:
                print(f"  - {error}")
            return False
        
        return True
    
    def print_summary(self):
        """Print configuration summary (without sensitive data)."""
        print("\n" + "="*60)
        print("PM PLUS Configuration Summary")
        print("="*60)
        print(f"State Store URL: {self.state_store_url}")
        print(f"Band REST URL: {self.band_rest_url}")
        print(f"Band WS URL: {self.band_ws_url}")
        print(f"LLM Provider: {self.llm_provider}")
        print(f"LLM Model: {self.aiml_model if self.llm_provider == 'aiml' else self.featherless_model}")
        print("\nAgents:")
        print(f"  - Risk Analyzer: {self.risk_analyzer.agent_id[:8]}...")
        print(f"  - Reporter: {self.reporter.agent_id[:8]}...")
        print(f"  - Resource Balancer: {self.resource_balancer.agent_id[:8]}...")
        print("\nRooms:")
        print(f"  - OPS Room: {self.ops_room_id[:8] if self.ops_room_id else 'Not set'}...")
        print(f"  - PM Alerts: {self.pm_alerts_room_id[:8] if self.pm_alerts_room_id else 'Not set'}...")
        print(f"  - Reports: {self.reports_room_id[:8] if self.reports_room_id else 'Not set'}...")
        print("="*60 + "\n")


# Global configuration instance
config = Config()


def get_config() -> Config:
    """Get the global configuration instance."""
    return config


# Validate configuration on import
if __name__ != "__main__":
    if not config.validate():
        print("\n⚠️  Warning: Configuration validation failed!")
        print("Some features may not work correctly.\n")

# Made with Bob
