/**
 * API Client for Ultimate Playlist Merger
 * Centralized API communication with error handling and retry logic
 */

// Get API base URL from environment or use current origin
const API_BASE_URL = window.API_BASE_URL || window.location.origin;

/**
 * Fetch wrapper with timeout and error handling
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  }
}

/**
 * Parse error response
 */
async function parseError(response) {
  try {
    const data = await response.json();
    return data.detail || data.message || "Unknown error occurred";
  } catch {
    return `Server error (${response.status})`;
  }
}

/**
 * API Client
 */
const API = {
  /**
   * Create a playlist merge job
   */
  async createPlaylistJob(url, filename, quality) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/create-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, filename, quality }),
      });

      if (!response.ok) {
        const error = await parseError(response);
        throw new Error(error);
      }

      return await response.json();
    } catch (error) {
      if (error.message === "Failed to fetch") {
        throw new Error(
          "Cannot connect to server. Please check your internet connection.",
        );
      }
      throw error;
    }
  },

  /**
   * Create a single video download job
   */
  async createVideoJob(url, quality) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/create-video-job`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, quality }),
        },
      );

      if (!response.ok) {
        const error = await parseError(response);
        throw new Error(error);
      }

      return await response.json();
    } catch (error) {
      if (error.message === "Failed to fetch") {
        throw new Error(
          "Cannot connect to server. Please check your internet connection.",
        );
      }
      throw error;
    }
  },

  /**
   * Get job status with retry logic
   */
  async getStatus(jobId, retries = 3) {
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/status/${encodeURIComponent(jobId)}`,
          {},
          10000, // 10s timeout for status checks
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Job not found");
          }
          const error = await parseError(response);
          throw new Error(error);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        if (i < retries - 1) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    throw lastError;
  },

  /**
   * Get download URL
   */
  getDownloadUrl(jobId) {
    return `${API_BASE_URL}/download/${encodeURIComponent(jobId)}`;
  },

  /**
   * Cleanup job files
   */
  async cleanup(jobId) {
    try {
      await fetchWithTimeout(
        `${API_BASE_URL}/cleanup/${encodeURIComponent(jobId)}`,
        {
          method: "POST",
        },
        10000,
      );
    } catch (error) {
      // Cleanup failures are non-critical
      console.warn("Cleanup failed:", error);
    }
  },

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/health`,
        {},
        5000,
      );
      return response.ok;
    } catch {
      return false;
    }
  },
};

// Export for use in other scripts
window.API = API;
window.API_BASE_URL = API_BASE_URL;
