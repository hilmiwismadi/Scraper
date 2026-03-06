import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const VPS_API_URL = process.env.VPS_API_URL || 'https://sales.webbuild.arachnova.id/api';
const VPS_API_TOKEN = process.env.VPS_API_TOKEN;

class VPSApiClient {
  constructor() {
    this.baseURL = VPS_API_URL;
    this.token = VPS_API_TOKEN;
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (this.token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }
  }

  // Start a new scraping session on VPS
  async startScraperSession(profileUrl, startIndex, endIndex, useAuth = false, username = null, password = null) {
    try {
      console.log('[API] Starting scraper session on VPS...');
      const response = await this.axios.post('/scraper/start', {
        profileUrl,
        startPostIndex: startIndex,
        endPostIndex: endIndex,
        useAuth,
        instagramUsername: username,
        instagramPassword: password
      });
      console.log('[API] Session started:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Failed to start session:', error.response?.data || error.message);
      throw error;
    }
  }

  // Upload scraped post data to VPS (single post - deprecated, use uploadScrapedPosts instead)
  async uploadScrapedPost(sessionId, postData) {
    try {
      console.log('[API] Uploading post to VPS...');
      console.log('[API] Session ID:', sessionId);
      console.log('[API] Post Index:', postData.postIndex);
      console.log('[API] Endpoint:', `${this.baseURL}/scraper/posts`);

      const response = await this.axios.post('/scraper/posts', {
        sessionId,
        ...postData
      });
      console.log('[API] Post uploaded successfully');
      return response.data;
    } catch (error) {
      console.error('[API] ========== UPLOAD POST ERROR ==========');
      console.error('[API] Error Status:', error.response?.status);
      console.error('[API] Error Data:', error.response?.data);
      console.error('[API] Post Index:', postData.postIndex);
      console.error('[API] ===========================================');
      throw error;
    }
  }

  // Upload multiple scraped posts to VPS in bulk
  async uploadScrapedPosts(sessionId, postsArray) {
    try {
      console.log('[API] Uploading posts to VPS (bulk)...');
      console.log('[API] Session ID:', sessionId);
      console.log('[API] Number of posts:', postsArray.length);
      console.log('[API] Endpoint:', `${this.baseURL}/scraper/posts`);

      // Log each post's phone numbers
      postsArray.forEach((post, idx) => {
        console.log(`[API] Post ${idx}: "${post.eventTitle}" | Phone1: "${post.phoneNumber1}" | Phone2: "${post.phoneNumber2}" | AllPhones:`, post.allPhones);
      });

      const response = await this.axios.post('/scraper/posts', {
        sessionId,
        posts: postsArray
      });

      console.log('[API] ✓ Posts uploaded successfully');
      console.log('[API] Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] ========== UPLOAD POSTS ERROR ==========');
      console.error('[API] Error Status:', error.response?.status);
      console.error('[API] Error Data:', error.response?.data);
      console.error('[API] Number of posts:', postsArray.length);
      console.error('[API] ===========================================');
      throw error;
    }
  }

  // Update session status on VPS
  async updateSessionStatus(sessionId, status, stats = {}) {
    try {
      const response = await this.axios.patch(`/scraper/sessions/${sessionId}`, {
        status,
        ...stats
      });
      return response.data;
    } catch (error) {
      console.error('[API] Failed to update session:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create session on VPS (for local scraping)
  async createLocalSession(profileUrl, startIndex, endIndex, useAuth = false, username = null, password = null) {
    try {
      console.log('[API] Creating local scraping session on VPS...');
      console.log('[API] Base URL:', this.baseURL);
      console.log('[API] Endpoint: /scraper/local-session');
      console.log('[API] Full URL:', `${this.baseURL}/scraper/local-session`);
      console.log('[API] Has Token:', !!this.token);
      console.log('[API] Request payload:', {
        profileUrl,
        startPostIndex: startIndex,
        endPostIndex: endIndex,
        useAuth
      });

      const response = await this.axios.post('/scraper/local-session', {
        profileUrl,
        startPostIndex: startIndex,
        endPostIndex: endIndex,
        useAuth,
        instagramUsername: username,
        instagramPassword: password
      });
      console.log('[API] Local session created:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] ========== VPS ERROR DETAILS ==========');
      console.error('[API] Error Status:', error.response?.status);
      console.error('[API] Error URL:', error.config?.url);
      console.error('[API] Full URL:', error.config?.baseURL + error.config?.url);
      console.error('[API] Error Headers:', error.response?.headers);
      console.error('[API] Error Data:', error.response?.data);
      console.error('[API] Error Message:', error.message);
      console.error('[API] ==========================================');
      throw error;
    }
  }

  // Save scraped data to local file (backup)
  saveToLocal(sessionId, data) {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `scraped-${sessionId.substring(0, 8)}-${Date.now()}.json`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`[BACKUP] Data saved to: ${filepath}`);
    return filepath;
  }
}

export default new VPSApiClient();
