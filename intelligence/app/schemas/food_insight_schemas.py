from pydantic import BaseModel


class FoodInsightRequest(BaseModel):
    apiKey: str
    systemPrompt: str
    userPrompt: str


class FoodInsightResponse(BaseModel):
    analysis: str
