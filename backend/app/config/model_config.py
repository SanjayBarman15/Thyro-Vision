# app/services/config/model_config.py
#Single config file reads all versions:
from pydantic_settings import BaseSettings, SettingsConfigDict

class ModelConfig(BaseSettings):
    pipeline_version: str
    roi_detector_version: str
    feature_classifier_version: str
    rule_engine_version: str
    
    roi_detector_weights: str
    feature_classifier_weights: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

# singleton — import this everywhere
model_config = ModelConfig()