// Input validation and sanitization utility

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  errors: string[];
  warnings: string[];
}

export class InputValidator {
  private static readonly MAX_LENGTH = 1000;
  private static readonly MIN_LENGTH = 1;
  
  /**
   * Validate and sanitize user input
   */
  static validate(input: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input.trim();
    
    // Check length
    if (sanitized.length < this.MIN_LENGTH) {
      errors.push('Query is too short');
      return { isValid: false, sanitized: '', errors, warnings };
    }
    
    if (sanitized.length > this.MAX_LENGTH) {
      errors.push(`Query exceeds maximum length of ${this.MAX_LENGTH} characters`);
      sanitized = sanitized.substring(0, this.MAX_LENGTH);
      warnings.push('Query was truncated');
    }
    
    // Remove potentially harmful characters (basic XSS prevention)
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    
    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(sanitized)) {
      warnings.push('Query contains unusual patterns');
    }
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
      warnings,
    };
  }
  
  private static containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /shell_exec/i,
      /base64_decode/i,
      /\.\.\//, // Path traversal
      /\.\.\\/, // Path traversal (Windows)
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  }
  
  /**
   * Check if input is potentially malicious
   */
  static isPotentiallyMalicious(input: string): boolean {
    const validation = this.validate(input);
    return validation.warnings.length > 0 || !validation.isValid;
  }
  
  /**
   * Normalize query for better processing
   */
  static normalize(query: string): string {
    let normalized = query.trim();
    
    // Fix common typos in agricultural terms
    const typoMap: Record<string, string> = {
      'maise': 'maize',
      'maze': 'maize',
      'cattel': 'cattle',
      'goats': 'goat', // Sometimes plural is used
      'chickens': 'chicken',
    };
    
    Object.entries(typoMap).forEach(([typo, correct]) => {
      const regex = new RegExp(`\\b${typo}\\b`, 'gi');
      normalized = normalized.replace(regex, correct);
    });
    
    // Remove excessive punctuation
    normalized = normalized.replace(/[!]{2,}/g, '!');
    normalized = normalized.replace(/[?]{2,}/g, '?');
    normalized = normalized.replace(/[.]{3,}/g, '...');
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }
}

