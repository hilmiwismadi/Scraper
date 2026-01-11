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

  // Upload scraped post data to VPS
  async uploadScrapedPost(sessionId, postData) {
    try {
      const response = await this.axios.post('/scraper/posts', {
        sessionId,
        ...postData
      });
      return response.data;
    } catch (error) {
      console.error('[API] Failed to upload post:', error.response?.data || error.message);
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
      console.error('[API] Failed to create local session:', error.response?.data || error.message);
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
