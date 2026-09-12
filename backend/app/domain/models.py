from dataclasses import dataclass
from datetime import date
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field


# Canonical Units
SupportedUnit = Literal["g", "kg", "ml", "L", "piece", "tsp", "tbsp", "cup"]


@dataclass(frozen=True)
class CanonicalIngredient:
    id: UUID | str
    canonical_key: str
    display_name_en: str
    display_name_mr: str | None = None
    aliases: tuple[str, ...] = ()
    food_groups: tuple[str, ...] = ()
    protein_contribution: str = "unknown"
    fibre_contribution: str = "unknown"
    carbohydrate_role: str = "unknown"
    fat_contribution: str = "unknown"
    fat_quality: str = "unknown"
    legume_identity: str | None = None
    grain_identity: str | None = None
    vegetable_identity: str | None = None
    vegetable_category: str = "unknown"
    fruit_identity: str | None = None
    seed_identity: str | None = None
    nut_identity: str | None = None
    whole_grain_or_millet: bool = False
    soaking_requirement: str = "unknown"
    advance_preparation: str = "unknown"
    provenance: str = "authored"
    metadata_status: str = "unknown"


@dataclass(frozen=True)
class DerivedRecipeFoodProfile:
    food_groups: frozenset[str] = frozenset()
    legume_identities: frozenset[str] = frozenset()
    grain_identities: frozenset[str] = frozenset()
    vegetable_identities: frozenset[str] = frozenset()
    fruit_identities: frozenset[str] = frozenset()
    seed_identities: frozenset[str] = frozenset()
    nut_identities: frozenset[str] = frozenset()
    has_whole_grain_or_millet: bool = False
    protein_contributions: frozenset[str] = frozenset()
    fibre_contributions: frozenset[str] = frozenset()
    carbohydrate_roles: frozenset[str] = frozenset()
    fat_contributions: frozenset[str] = frozenset()
    fat_qualities: frozenset[str] = frozenset()
    provenance: str = "derived"


class Ingredient(BaseModel):
    id: str | None = None
    canonical_key: str
    name: str
    marathi_name: str
    display_name_en: str | None = None
    display_name_mr: str | None = None
    aliases: list[str] = Field(default_factory=list)
    category: str | None = None
    default_unit: str = "g"
    active: bool = True
    food_groups: list[str] = Field(default_factory=list)
    protein_contribution: str = "unknown"
    fibre_contribution: str = "unknown"
    carbohydrate_role: str = "unknown"
    fat_contribution: str = "unknown"
    fat_quality: str = "unknown"
    legume_identity: str | None = None
    grain_identity: str | None = None
    vegetable_identity: str | None = None
    vegetable_category: str = "unknown"
    fruit_identity: str | None = None
    seed_identity: str | None = None
    nut_identity: str | None = None
    whole_grain_or_millet: bool = False
    soaking_requirement: str = "unknown"
    advance_preparation: str = "unknown"
    provenance: str = "authored"
    metadata_status: str = "unknown"

    def to_canonical(self) -> CanonicalIngredient:
        return CanonicalIngredient(
            id=self.id or self.canonical_key,
            canonical_key=self.canonical_key,
            display_name_en=self.display_name_en or self.name,
            display_name_mr=self.display_name_mr or self.marathi_name,
            aliases=tuple(self.aliases),
            food_groups=tuple(self.food_groups),
            protein_contribution=self.protein_contribution,
            fibre_contribution=self.fibre_contribution,
            carbohydrate_role=self.carbohydrate_role,
            fat_contribution=self.fat_contribution,
            fat_quality=self.fat_quality,
            legume_identity=self.legume_identity,
            grain_identity=self.grain_identity,
            vegetable_identity=self.vegetable_identity,
            vegetable_category=self.vegetable_category,
            fruit_identity=self.fruit_identity,
            seed_identity=self.seed_identity,
            nut_identity=self.nut_identity,
            whole_grain_or_millet=self.whole_grain_or_millet,
            soaking_requirement=self.soaking_requirement,
            advance_preparation=self.advance_preparation,
            provenance=self.provenance,
            metadata_status=self.metadata_status,
        )


class RecipeIngredient(BaseModel):
    ingredient_id: str | None = None
    ingredient_key: str
    quantity: float
    unit: str
    display_text: str | None = None
    preparation: str | None = None
    sort_order: int = 0


class DietaryFlags(BaseModel):
    contains_egg: bool = False
    vegetarian: bool = True
    vegetables: bool = False
    legumes: bool = False
    whole_grains: bool = False
    fruit: bool = False
    dairy: bool = False


class NutritionMetadata(BaseModel):
    protein_source: str | None = None
    fibre_contribution: str | None = None
    whole_grain: bool = False
    vegetables: bool = False
    fruits: bool = False
    legumes: bool = False
    egg: bool = False
    dairy: bool = False
    raw: dict[str, Any] = Field(default_factory=dict)


class PracticalMetadata(BaseModel):
    meal_density: str = "moderate"  # light, moderate, substantial, heavy
    meal_form: str = "curry_sabji"  # chilla, khichdi, poha, curry_sabji, etc.
    primary_grain: str | None = None  # wheat, rice, millet, poha, oats, none
    primary_protein_source: str = "legume"  # legume, dairy_paneer, egg, nuts_seeds, soy
    cooking_burden: str = "moderate"
    time_minutes: int = 30
    soaking_required: bool = False
    fermentation_required: bool = False
    batch_prep_compatible: bool = False


class Recipe(BaseModel):
    id: str
    recipe_key: str | None = None
    name: str
    marathi_name: str
    course: str | None = "Lunch/Dinner"
    meal_category: str | None = "Lunch/Dinner"
    meal_role: str | None = "main"  # main, side, snack
    servings: float = 4.0
    time_text: str | None = "30 min"
    cooking_method: str | None = "Stovetop"
    description: str | None = None
    marathi_description: str | None = None
    meal_form: str | None = None
    preparation_time_minutes: int | None = None
    preparation_burden: str = "unknown"
    soaking_requirement: str = "unknown"
    fermentation_requirement: str = "unknown"
    batch_prep_suitability: str = "unknown"
    ingredients: list[str] = Field(default_factory=list)
    structured_ingredients: list[RecipeIngredient] = Field(default_factory=list)
    legacy_unmapped: list[str] = Field(default_factory=list)
    method: list[str] = Field(default_factory=list)
    note: str | None = None
    dietary_flags: DietaryFlags = Field(default_factory=DietaryFlags)
    nutrition_metadata: NutritionMetadata = Field(default_factory=NutritionMetadata)
    practical_metadata: PracticalMetadata = Field(default_factory=PracticalMetadata)
    food_profile: DerivedRecipeFoodProfile | None = None


class FamilyMember(BaseModel):
    id: str
    member_key: str
    name: str
    marathi_name: str
    age: int
    sex: str | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    activity: str | None = None
    note: str | None = None
    sort_order: int = 0


class DietaryRule(BaseModel):
    id: str | None = None
    rule_key: str
    ingredient_key: str
    allowed_member_ids: list[str] = Field(default_factory=list)
    disallowed_member_ids: list[str] = Field(default_factory=list)
    alternate_policy: str = "vegetarian-existing"
    active: bool = True


class FrequencyRule(BaseModel):
    id: str | None = None
    rule_key: str
    ingredient_key: str
    max_per_calendar_month: int = 5
    period: str = "calendar-month"
    rule_type: str = "ingredient_frequency"
    preference_type: str = "household_planning"
    label: str = "Paneer Frequency"
    marathi_label: str = "पनीर वारंवारता"
    description: str = "Household planning preference"
    marathi_description: str = "घरगुती नियोजन प्राधान्य"
    active: bool = True


class DecisionMetadata(BaseModel):
    planner_version: str = "fastapi-beam-v1"
    selected_because: list[str] = Field(default_factory=list)
    applied_rules: list[str] = Field(default_factory=list)
    soft_penalties: list[str] = Field(default_factory=list)
    alternatives_considered: list[str] = Field(default_factory=list)
    planning_horizon: dict[str, int] = Field(default_factory=lambda: {"visible_days": 7, "evaluation_days": 30})


class MealAssignment(BaseModel):
    id: str | None = None
    meal_entry_id: str
    member_id: str
    recipe_id: str | None = None
    portion_factor: float = 1.0
    assignment_source: Literal["automatic", "manual"] = "automatic"
    automatic_recipe_id: str | None = None
    override_recipe_id: str | None = None
    override_reason: str | None = None


class MealPlanSlot(BaseModel):
    id: str
    date: str
    slot: str
    title: str
    marathi_title: str
    recipe_id: str
    recipe: Recipe | None = None
    status: str = "Planned"
    assignments: list[MealAssignment] = Field(default_factory=list)
    explanation: dict[str, Any] = Field(default_factory=dict)


class EvaluationSummary(BaseModel):
    visible_days: int = 7
    evaluation_days: int = 30
    total_meals_planned: int = 0
    start_date: str


class PlanningRequest(BaseModel):
    start_date: str = Field(default_factory=lambda: date.today().isoformat())
    visible_days: int = 7
    evaluation_days: int = 30
    household_id: str | None = None
    overrides: dict[str, Any] = Field(default_factory=dict)


class PlanningResponse(BaseModel):
    success: bool
    plan: list[MealPlanSlot]
    recipes: list[Recipe] = Field(default_factory=list)
    members: list[FamilyMember] = Field(default_factory=list)
    prep_tasks: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evaluation_summary: EvaluationSummary


class CurrentMealContext(BaseModel):
    date: str
    slot: str
    recipe_id: str | None = None
    title: str | None = None
    recipe: Recipe | None = None


class AlternativeMeal(BaseModel):
    recipe: Recipe
    score: float
    explanation: dict[str, Any] = Field(default_factory=dict)


class MealChangeRequest(BaseModel):
    current_meal: CurrentMealContext
    reason: str
    household_id: str | None = None
    unavailable_ingredients: list[str] = Field(default_factory=list)
    custom_constraint: str | None = None


class MealChangeResponse(BaseModel):
    success: bool
    reason_applied: str
    alternatives: list[AlternativeMeal]
    recommendation: AlternativeMeal | None = None
    warnings: list[str] = Field(default_factory=list)
