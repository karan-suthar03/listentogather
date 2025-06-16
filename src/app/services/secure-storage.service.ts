/**
 * Secure localStorage utility that only stores minimal, non-sensitive data
 */
export class SecureStorageService {
  private static readonly USER_KEY = 'listentogether_session';

  /**
   * Store only minimal user session data (no sensitive information like isHost)
   */
  static storeUserSession(userId: string, roomCode: string): void {
    try {
      const sessionData = {
        userId,
        roomCode,
        timestamp: Date.now()
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error storing user session:', error);
    }
  }

  /**
   * Get stored user session data
   */
  static getUserSession(): { userId: string; roomCode: string; timestamp: number } | null {
    try {
      const stored = localStorage.getItem(this.USER_KEY);
      if (!stored) return null;

      const sessionData = JSON.parse(stored);

      // Validate session data structure
      if (!sessionData.userId || !sessionData.roomCode || !sessionData.timestamp) {
        this.clearUserSession();
        return null;
      }

      // Check if session is expired (24 hours)
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if (Date.now() - sessionData.timestamp > TWENTY_FOUR_HOURS) {
        this.clearUserSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Error reading user session:', error);
      this.clearUserSession();
      return null;
    }
  }

  /**
   * Clear user session data
   */
  static clearUserSession(): void {
    try {
      localStorage.removeItem(this.USER_KEY);
    } catch (error) {
      console.error('Error clearing user session:', error);
    }
  }

  /**
   * Check if user has a valid session for a specific room
   */
  static hasValidSession(roomCode: string): boolean {
    const session = this.getUserSession();
    return session !== null && session.roomCode === roomCode;
  }
}
