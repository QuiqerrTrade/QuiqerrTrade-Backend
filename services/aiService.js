const axios = require('axios');

class AIService {
  /**
   * Predict viral potential of a remix
   */
  async predictViralPotential(remixData, parentTrack) {
    try {
      const prompt = `
        Analyze this remix's viral potential based on:
        - Genre: ${parentTrack.genre}
        - Parent track volume: ${parentTrack.stats.totalVolume} USDC
        - Remix style: ${remixData.style}
        - Time since parent release: ${this.getDaysSince(parentTrack.createdAt)} days
        
        Return a score 0-100 and brief reasoning.
      `;

      const response = await this.callAI(prompt);
      
      // Parse response to extract score
      const score = this.extractScore(response);
      
      return {
        viralPotential: score,
        reasoning: response,
        suggestedAction: score > 70 ? 'BUY' : score > 40 ? 'WATCH' : 'PASS',
      };
    } catch (error) {
      console.error('AI prediction error:', error);
      return {
        viralPotential: 50,
        reasoning: 'AI analysis unavailable',
        suggestedAction: 'WATCH',
      };
    }
  }

  /**
   * Suggest remix opportunities for a creator
   */
  async suggestRemixOpportunities(user, genre) {
    try {
      const prompt = `
        Suggest which tracks this user should remix based on:
        - User level: ${user.remixerLevel}
        - Preferred genre: ${genre}
        - Total earned: ${user.totalEarned} USDC
        
        Focus on high-volume, trending tracks.
      `;

      return await this.callAI(prompt);
    } catch (error) {
      console.error('AI suggestion error:', error);
      return 'Focus on trending Afrobeats tracks with high volume.';
    }
  }

  /**
   * Generate trader insights for a remix
   */
  async generateTraderInsight(remixStats) {
    try {
      const prompt = `
        Analyze this trading data and provide a brief insight:
        - Current price: ${remixStats.currentPrice} USDC
        - 24h volume: ${remixStats.volume24h} USDC
        - Price change 24h: ${remixStats.priceChange24h}%
        - Holders: ${remixStats.holders}
        
        Is this remix undervalued, fairly valued, or overvalued?
      `;

      return await this.callAI(prompt);
    } catch (error) {
      console.error('AI insight error:', error);
      return 'Market data suggests moderate interest. Watch for volume spikes.';
    }
  }

  /**
   * Call AI API (OpenAI/Claude)
   */
  async callAI(prompt) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a music market analyst specializing in viral trends and token trading.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 150,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  extractScore(response) {
    const match = response.match(/\b([0-9]{1,3})\b/);
    return match ? parseInt(match[1]) : 50;
  }

  getDaysSince(date) {
    return Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
  }
}

module.exports = new AIService();