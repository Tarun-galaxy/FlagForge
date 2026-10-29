from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, Dict, List
from datetime import datetime


class FlagBase(BaseModel):
    name: str = Field(..., max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    owner_team: Optional[str] = Field(None, max_length=100)


class FlagCreate(FlagBase):
    key: str = Field(..., max_length=100)
    type: str = Field(..., description="Must be 'boolean', 'string', or 'number'")
    default_value: str = Field(..., description="Default value represented as a string")
    is_enabled: bool = Field(False)
    environment: str = Field("development", description="Environment to set is_enabled and default_value for")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("boolean", "string", "number"):
            raise ValueError("type must be one of: 'boolean', 'string', 'number'")
        return v

    @field_validator("default_value")
    @classmethod
    def validate_default_value(cls, v: str, info) -> str:
        # We can validate default_value format based on type if type is present
        flag_type = info.data.get("type")
        if flag_type == "boolean":
            if v.lower() not in ("true", "false"):
                raise ValueError("default_value must be 'true' or 'false' for boolean type")
        elif flag_type == "number":
            try:
                float(v)
            except ValueError:
                raise ValueError("default_value must be a valid number for number type")
        return v


class FlagUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    is_enabled: Optional[bool] = None
    default_value: Optional[str] = None
    owner_team: Optional[str] = Field(None, max_length=100)


class FlagResponse(FlagBase):
    id: int
    flag_key: str
    type: str
    default_value: str
    is_enabled: bool
    environment_id: int
    rollout_percentage: Optional[int] = 100
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True



class PriorityStep(BaseModel):
    step: int
    name: str
    status: str  # "Matched", "No match", "Skipped"
    detail: Optional[str] = None


class EvaluationRequest(BaseModel):
    flag_key: Optional[str] = None
    key: Optional[str] = None
    environment: str = "development"
    user_id: Optional[str] = None
    groups: Optional[Any] = None  # Can be List[str] or string
    context: Optional[Dict[str, Any]] = None
    user_context: Optional[Dict[str, Any]] = None


class EvaluationResponse(BaseModel):
    flag_key: str
    key: Optional[str] = None
    value: Any
    type: str
    environment: str
    is_enabled: bool
    reason: str
    matched_rule: Optional[str] = None
    rule_detail: Optional[str] = None
    priority_steps: List[PriorityStep] = Field(default_factory=list)
    evaluated_at: Optional[Any] = None
    request_summary: Optional[Dict[str, Any]] = None
    cached: bool = False
    served_from_cache: bool = False
    latency_ms: Optional[float] = None



class TargetingRuleResponse(BaseModel):
    id: int
    flag_id: int
    rule_type: str
    rule_value: str

    class Config:
        from_attributes = True


class TargetingRuleSave(BaseModel):
    rule_type: str = "whitelist"
    rule_value: str


class TargetingRulesResponse(BaseModel):
    whitelist: str = ""
    groups: str = ""
    percentage: int = 0


class TargetingRulesSave(BaseModel):
    whitelist: str = ""
    groups: str = ""
    percentage: int = 0


class FlagOverrideResponse(BaseModel):
    environment_id: int
    environment_name: str
    environment_description: Optional[str] = None
    override_value: Optional[str] = None
    status: str  # "Overridden" or "Using Default"
    updated_at: Optional[datetime] = None


class FlagOverrideSave(BaseModel):
    value: str
    active: bool

