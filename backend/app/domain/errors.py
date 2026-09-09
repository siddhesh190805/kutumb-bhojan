"""Explicit domain error definitions for Kutumb Bhojan."""


class DomainError(Exception):
    """Base class for all domain errors."""
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class HouseholdNotFoundError(DomainError):
    def __init__(self, household_id: str):
        super().__init__(f"Household not found: {household_id}", code="HOUSEHOLD_NOT_FOUND")


class RecipeNotFoundError(DomainError):
    def __init__(self, recipe_id: str):
        super().__init__(f"Recipe not found: {recipe_id}", code="RECIPE_NOT_FOUND")


class NoEligibleRecipeError(DomainError):
    def __init__(self, context: str):
        super().__init__(f"No eligible recipe found: {context}", code="NO_ELIGIBLE_RECIPE")


class PlanningConflictError(DomainError):
    def __init__(self, reason: str):
        super().__init__(f"Planning conflict encountered: {reason}", code="PLANNING_CONFLICT")


class InvalidOverrideError(DomainError):
    def __init__(self, details: str):
        super().__init__(f"Invalid meal override: {details}", code="INVALID_OVERRIDE")


class CanonicalDataIncompleteError(DomainError):
    def __init__(self, details: str):
        super().__init__(f"Authoritative canonical domain data is incomplete: {details}", code="CANONICAL_DATA_INCOMPLETE")
