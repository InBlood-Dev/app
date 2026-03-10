/**
 * Filter Mapping Utilities
 * Maps UI filter values to backend API format and vice versa
 */

/**
 * Maps UI gender preference to backend interested_in array
 * @param gender UI gender value ('women' | 'men' | 'everyone')
 * @returns Array of backend gender values
 */
export const mapGenderToInterestedIn = (gender: string): string[] => {
  switch (gender.toLowerCase()) {
    case 'women':
      return ['female'];
    case 'men':
      return ['male'];
    case 'everyone':
      // Include all four values as per user preference
      return ['male', 'female', 'non-binary', 'everyone'];
    default:
      // Default to everyone if unknown value
      return ['male', 'female', 'non-binary', 'everyone'];
  }
};

/**
 * Maps backend interested_in array to UI gender preference
 * @param interestedIn Backend interested_in array
 * @returns UI gender value ('women' | 'men' | 'everyone')
 */
export const mapInterestedInToGender = (interestedIn: string[]): string => {
  if (!interestedIn || interestedIn.length === 0) {
    return 'everyone';
  }

  // Check for single specific gender
  if (interestedIn.length === 1) {
    if (interestedIn[0] === 'female') {
      return 'women';
    }
    if (interestedIn[0] === 'male') {
      return 'men';
    }
  }

  // Multiple values or 'everyone' included means "everyone"
  return 'everyone';
};

/**
 * Validates filter values before sending to backend
 * @param ageMin Minimum age
 * @param ageMax Maximum age
 * @param distance Maximum distance in km
 * @returns Validation result with error message if invalid
 */
export const validateFilters = (
  ageMin: number,
  ageMax: number,
  distance: number
): { valid: boolean; error?: string } => {
  // Validate age minimum
  if (ageMin < 18) {
    return { valid: false, error: 'Minimum age must be at least 18' };
  }
  if (ageMin > 99) {
    return { valid: false, error: 'Minimum age cannot exceed 99' };
  }

  // Validate age maximum
  if (ageMax < 18) {
    return { valid: false, error: 'Maximum age must be at least 18' };
  }
  if (ageMax > 99) {
    return { valid: false, error: 'Maximum age cannot exceed 99' };
  }

  // Validate age range relationship
  if (ageMin > ageMax) {
    return { valid: false, error: 'Minimum age cannot exceed maximum age' };
  }

  // Validate distance
  if (distance < 1) {
    return { valid: false, error: 'Distance must be at least 1 km' };
  }
  if (distance > 100) {
    return { valid: false, error: 'Distance cannot exceed 100 km' };
  }

  return { valid: true };
};
