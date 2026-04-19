const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    // Initialize SendGrid with API key
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    this.from = {
      email: process.env.EMAIL_FROM || 'noreply@quiqerrtrade.com',
      name: 'QuiqerrTrade Market',
    };
    
    this.frontendUrl = process.env.FRONTEND_URL || 'https://quiqerrtrade.vercel.app';
    this.supportEmail = process.env.SUPPORT_EMAIL || 'waleayomideadetokun@gmail.com';
  }

  /**
   * Send email using SendGrid
   * @param {Object} options - Email options
   * @returns {Promise} SendGrid response
   */
  async sendEmail({ to, subject, html, text, templateId, dynamicTemplateData }) {
    try {
      const msg = {
        to,
        from: this.from,
        subject,
        text: text || this.stripHtml(html),
        html,
      };

      // Use template if provided
      if (templateId) {
        msg.templateId = templateId;
        msg.dynamicTemplateData = dynamicTemplateData;
      }

      const response = await sgMail.send(msg);
      
      console.log(`✅ Email sent to ${to}: ${subject}`);
      return response;
    } catch (error) {
      console.error('SendGrid Error:', error.response?.body || error.message);
      
      // In development, log to console instead of failing
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Development Mode - Email content:');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('HTML:', html?.substring(0, 500));
        return { success: true, mode: 'development' };
      }
      
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    const subject = '🎧 Welcome to QuiqerrTrade Market!';
    const html = await this.getTemplate('welcome', {
      name: user.displayName || user.personalInfo?.firstName || 'Creator',
      walletAddress: user.walletAddress?.slice(0, 4) + '...' + user.walletAddress?.slice(-4),
      loginUrl: `${this.frontendUrl}/dashboard`,
      exploreUrl: `${this.frontendUrl}/market`,
      uploadUrl: `${this.frontendUrl}/upload`,
      supportEmail: this.supportEmail,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(user, token) {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    const subject = 'Verify Your Email - QuiqerrTrade Market';
    
    const html = await this.getTemplate('verify-email', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      verificationUrl,
      expiresIn: '24 hours',
      supportEmail: this.supportEmail,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, token) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset Your Password - QuiqerrTrade Market';
    
    const html = await this.getTemplate('reset-password', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      resetUrl,
      expiresIn: '1 hour',
      supportEmail: this.supportEmail,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send earnings update notification
   */
  async sendEarningsUpdateEmail(user, earnings) {
    const subject = '💰 Earnings Update - QuiqerrTrade Market';
    
    const html = await this.getTemplate('earnings-update', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      totalEarned: earnings.total.toFixed(2),
      asCreator: earnings.asCreator.toFixed(2),
      asRemixer: earnings.asRemixer.toFixed(2),
      asTrader: earnings.asTrader.toFixed(2),
      dashboardUrl: `${this.frontendUrl}/dashboard/earnings`,
      withdrawUrl: `${this.frontendUrl}/wallet/withdraw`,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send new remix notification to original creator
   */
  async sendNewRemixNotification(creator, remixer, track, remix) {
    const subject = `🎵 New Remix: "${remix.title}" - QuiqerrTrade Market`;
    
    const html = await this.getTemplate('new-remix', {
      name: creator.displayName || creator.personalInfo?.firstName || 'Creator',
      remixerName: remixer.displayName || remixer.username || 'A remixer',
      trackTitle: track.title,
      remixTitle: remix.title,
      remixStyle: remix.style,
      remixUrl: `${this.frontendUrl}/remix/${remix._id}`,
      trackUrl: `${this.frontendUrl}/track/${track._id}`,
      potentialEarnings: '45% of all trading fees',
    });

    return this.sendEmail({
      to: creator.email,
      subject,
      html,
    });
  }

  /**
   * Send trade confirmation
   */
  async sendTradeConfirmationEmail(user, transaction) {
    const subject = transaction.type === 'buy' 
      ? `📈 Buy Order Confirmed - QuiqerrTrade Market`
      : `📉 Sell Order Confirmed - QuiqerrTrade Market`;
    
    const html = await this.getTemplate('trade-confirmation', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      type: transaction.type.toUpperCase(),
      remixTitle: transaction.remix?.title || 'Remix',
      amount: transaction.amount,
      pricePerToken: transaction.pricePerToken.toFixed(4),
      totalValue: transaction.totalValue.toFixed(2),
      txSignature: transaction.solanaTxSignature,
      explorerUrl: `https://solscan.io/tx/${transaction.solanaTxSignature}?cluster=devnet`,
      portfolioUrl: `${this.frontendUrl}/portfolio`,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send level up notification
   */
  async sendLevelUpEmail(user, role, newLevel) {
    const levelNames = {
      creator: {
        new_creator: 'New Creator',
        rising_creator: 'Rising Creator',
        viral_creator: 'Viral Creator',
        top_creator: 'Top Creator',
      },
      remixer: {
        beginner: 'Beginner',
        skilled: 'Skilled Remixer',
        pro: 'Pro Remixer',
        elite: 'Elite Remixer',
      },
    };

    const levelName = levelNames[role][newLevel];
    const subject = `🏆 You've Reached ${levelName} - QuiqerrTrade Market`;
    
    const rewards = this.getLevelRewards(role, newLevel);
    
    const html = await this.getTemplate('level-up', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      role: role === 'creator' ? 'Creator' : 'Remixer',
      newLevel: levelName,
      rewards,
      dashboardUrl: `${this.frontendUrl}/dashboard`,
      shareUrl: `${this.frontendUrl}/profile/${user.username || user._id}`,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send badge earned notification
   */
  async sendBadgeEarnedEmail(user, badge) {
    const subject = `🎖️ New Badge Earned: ${badge.name} - QuiqerrTrade Market`;
    
    const html = await this.getTemplate('badge-earned', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      badgeName: badge.name,
      badgeDescription: badge.description,
      badgeIcon: badge.icon,
      badgeRarity: badge.rarity,
      profileUrl: `${this.frontendUrl}/profile/${user.username || user._id}`,
      shareText: `I just earned the ${badge.name} badge on QuiqerrTrade Market! 🎧💹`,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(user, activity) {
    const subject = '🔒 Security Alert - QuiqerrTrade Market';
    
    const html = await this.getTemplate('security-alert', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      activity,
      timestamp: new Date().toLocaleString(),
      ipAddress: user.security?.lastLoginIp || 'Unknown',
      actionUrl: `${this.frontendUrl}/settings/security`,
      supportEmail: this.supportEmail,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Send weekly digest
   */
  async sendWeeklyDigest(user, stats) {
    const subject = `📊 Your Weekly QuiqerrTrade Market Digest`;
    
    const html = await this.getTemplate('weekly-digest', {
      name: user.displayName || user.personalInfo?.firstName || 'User',
      weekStart: stats.weekStart,
      weekEnd: stats.weekEnd,
      weeklyEarnings: stats.earnings.toFixed(2),
      weeklyTrades: stats.trades,
      newFollowers: stats.newFollowers,
      topPerformingRemix: stats.topRemix,
      portfolioValue: stats.portfolioValue.toFixed(2),
      marketUrl: `${this.frontendUrl}/market`,
      dashboardUrl: `${this.frontendUrl}/dashboard`,
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  /**
   * Get email template HTML
   */
  async getTemplate(templateName, data) {
    // In production, you'd use SendGrid Dynamic Templates
    // Here we provide inline HTML templates for simplicity
    
    const templates = {
      'welcome': this.welcomeTemplate(data),
      'verify-email': this.verifyEmailTemplate(data),
      'reset-password': this.resetPasswordTemplate(data),
      'earnings-update': this.earningsUpdateTemplate(data),
      'new-remix': this.newRemixTemplate(data),
      'trade-confirmation': this.tradeConfirmationTemplate(data),
      'level-up': this.levelUpTemplate(data),
      'badge-earned': this.badgeEarnedTemplate(data),
      'security-alert': this.securityAlertTemplate(data),
      'weekly-digest': this.weeklyDigestTemplate(data),
    };

    return templates[templateName] || this.defaultTemplate(data);
  }

  /**
   * Welcome email template
   */
  welcomeTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎧 Welcome to QuiqerrTrade Market!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>Welcome to the future of music creation and trading! We're thrilled to have you join the QuiqerrTrade Market community.</p>
          <p>Your wallet <code>${data.walletAddress}</code> is now connected and ready to start earning.</p>
          <h3>🚀 Get Started:</h3>
          <ul>
            <li><strong>Explore the Market</strong> - Discover trending remixes and start trading</li>
            <li><strong>Upload Your First Track</strong> - Share your original music and earn royalties</li>
            <li><strong>Create Remixes</strong> - Turn your creativity into tradable tokens</li>
          </ul>
          <div style="text-align: center;">
            <a href="${data.exploreUrl}" class="button">Explore Market</a>
            <a href="${data.uploadUrl}" class="button" style="background: #764ba2; margin-left: 10px;">Upload Track</a>
          </div>
          <p>Need help? Reply to this email or reach out to <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>.</p>
          <p>Let's make some noise! 🎵💹</p>
          <p>- The QuiqerrTrade Market Team</p>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
          <p>You're receiving this because you signed up for QuiqerrTrade Market.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Email verification template
   */
  verifyEmailTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; }
          .code { background: #e9ecef; padding: 15px; font-size: 24px; letter-spacing: 5px; text-align: center; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>Thanks for signing up! Please verify your email address to access all features.</p>
          <div style="text-align: center;">
            <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link:</p>
          <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">${data.verificationUrl}</p>
          <p><strong>This link expires in ${data.expiresIn}.</strong></p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Password reset template
   */
  resetPasswordTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </div>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link expires in ${data.expiresIn}. If you didn't request this change, please contact support immediately.
          </div>
          <p>Or copy this link:</p>
          <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">${data.resetUrl}</p>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }


  /**
   * Earnings update template
   */
  earningsUpdateTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .earnings-box { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .amount { font-size: 32px; font-weight: bold; color: #28a745; }
          .breakdown { display: flex; justify-content: space-around; margin: 20px 0; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>💰 Earnings Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <div class="earnings-box">
            <p style="margin: 0; color: #6c757d;">Total Earnings</p>
            <p class="amount">$${data.totalEarned} USDC</p>
          </div>
          <div class="breakdown">
            <div><strong>As Creator:</strong> $${data.asCreator}</div>
            <div><strong>As Remixer:</strong> $${data.asRemixer}</div>
            <div><strong>As Trader:</strong> $${data.asTrader}</div>
          </div>
          <div style="text-align: center;">
            <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
            <a href="${data.withdrawUrl}" class="button" style="background: #6c757d;">Withdraw</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * New remix notification template
   */
  newRemixTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .remix-info { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎵 New Remix Alert!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p><strong>${data.remixerName}</strong> just created a remix of your track!</p>
          <div class="remix-info">
            <h3>${data.remixTitle}</h3>
            <p>Original: ${data.trackTitle}</p>
            <p>Style: ${data.remixStyle}</p>
            <p><strong>You earn ${data.potentialEarnings} on this remix!</strong></p>
          </div>
          <div style="text-align: center;">
            <a href="${data.remixUrl}" class="button">Listen to Remix</a>
            <a href="${data.trackUrl}" class="button" style="background: #764ba2;">View Track</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Trade confirmation template
   */
  tradeConfirmationTemplate(data) {
    const isBuy = data.type === 'BUY';
    const color = isBuy ? '#28a745' : '#dc3545';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${color}; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .trade-details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
          .button { display: inline-block; background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${data.type} Order Confirmed</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>Your ${data.type.toLowerCase()} order has been successfully processed.</p>
          <div class="trade-details">
            <div class="detail-row">
              <span>Remix:</span>
              <strong>${data.remixTitle}</strong>
            </div>
            <div class="detail-row">
              <span>Amount:</span>
              <strong>${data.amount} tokens</strong>
            </div>
            <div class="detail-row">
              <span>Price per token:</span>
              <strong>$${data.pricePerToken} USDC</strong>
            </div>
            <div class="detail-row">
              <span>Total value:</span>
              <strong>$${data.totalValue} USDC</strong>
            </div>
            <div class="detail-row">
              <span>Transaction:</span>
              <a href="${data.explorerUrl}" style="font-family: monospace;">${data.txSignature?.slice(0, 8)}...${data.txSignature?.slice(-8)}</a>
            </div>
          </div>
          <div style="text-align: center;">
            <a href="${data.portfolioUrl}" class="button">View Portfolio</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Level up template
   */
  levelUpTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .level-badge { font-size: 48px; margin: 20px 0; }
          .rewards { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .button { display: inline-block; background: #ff8c00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏆 Level Up!</h1>
          <div class="level-badge">⬆️</div>
        </div>
        <div class="content">
          <p>Congratulations ${data.name}!</p>
          <h2>You've reached ${data.newLevel} ${data.role}!</h2>
          <div class="rewards">
            <h3>🎁 New Rewards Unlocked:</h3>
            <ul>
              ${data.rewards.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
          <div style="text-align: center;">
            <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
            <a href="${data.shareUrl}" class="button" style="background: #1da1f2;">Share Achievement</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Badge earned template
   */
  badgeEarnedTemplate(data) {
    const rarityColors = {
      common: '#6c757d',
      rare: '#007bff',
      epic: '#6f42c1',
      legendary: '#ffd700',
    };
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${rarityColors[data.badgeRarity] || '#667eea'}; color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .badge-icon { font-size: 64px; margin: 20px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎖️ New Badge Earned!</h1>
          <div class="badge-icon">${data.badgeIcon || '🏅'}</div>
        </div>
        <div class="content">
          <p>Amazing work, ${data.name}!</p>
          <h2>${data.badgeName}</h2>
          <p style="color: ${rarityColors[data.badgeRarity]}; text-transform: uppercase;">${data.badgeRarity}</p>
          <p>${data.badgeDescription}</p>
          <div style="text-align: center;">
            <a href="${data.profileUrl}" class="button">View Profile</a>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(data.shareText)}" class="button" style="background: #1da1f2;">Share on X</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Security alert template
   */
  securityAlertTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔒 Security Alert</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <div class="alert-box">
            <p><strong>${data.activity}</strong></p>
            <p>Time: ${data.timestamp}</p>
            <p>IP Address: ${data.ipAddress}</p>
          </div>
          <p>If this was you, no action is needed.</p>
          <p><strong>If you don't recognize this activity, please secure your account immediately.</strong></p>
          <div style="text-align: center;">
            <a href="${data.actionUrl}" class="button">Review Security Settings</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Weekly digest template
   */
  weeklyDigestTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 40px 20px; border-radius: 0 0 10px 10px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 10px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Weekly Digest</h1>
          <p>${data.weekStart} - ${data.weekEnd}</p>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>Here's your weekly summary on QuiqerrTrade Market:</p>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">$${data.weeklyEarnings}</div>
              <div>Earnings</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.weeklyTrades}</div>
              <div>Trades</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">+${data.newFollowers}</div>
              <div>New Followers</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">$${data.portfolioValue}</div>
              <div>Portfolio Value</div>
            </div>
          </div>
          ${data.topPerformingRemix ? `
            <h3>🔥 Top Performing Remix</h3>
            <p>${data.topPerformingRemix}</p>
          ` : ''}
          <div style="text-align: center;">
            <a href="${data.dashboardUrl}" class="button">View Full Dashboard</a>
            <a href="${data.marketUrl}" class="button" style="background: #764ba2;">Explore Market</a>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 QuiqerrTrade Market. All rights reserved.</p>
          <p><a href="${this.frontendUrl}/settings/notifications">Manage email preferences</a></p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Default template
   */
  defaultTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <h1>QuiqerrTrade Market</h1>
        <p>${data.message || 'Thank you for using QuiqerrTrade Market!'}</p>
      </body>
      </html>
    `;
  }

  /**
   * Strip HTML tags for plain text version
   */
  stripHtml(html) {
    return html?.replace(/<[^>]*>/g, '') || '';
  }

  /**
   * Get level rewards
   */
  getLevelRewards(role, level) {
    const rewards = {
      creator: {
        new_creator: ['Upload up to 5 tracks', 'Basic analytics'],
        rising_creator: ['Upload up to 20 tracks', 'Advanced analytics', 'Featured in discovery'],
        viral_creator: ['Unlimited uploads', 'Priority support', 'Custom badge'],
        top_creator: ['Unlimited uploads', 'VIP support', 'Exclusive events', 'Revenue boost'],
      },
      remixer: {
        beginner: ['Create up to 10 remixes', 'Basic royalty split'],
        skilled: ['Create up to 50 remixes', 'Enhanced royalty split'],
        pro: ['Unlimited remixes', 'Featured in market', 'Early access to new features'],
        elite: ['Unlimited remixes', 'Maximum royalty split', 'Exclusive collaborations', 'Verified badge'],
      },
    };

    return rewards[role]?.[level] || ['New level achieved!'];
  }
}

// Export singleton instance
module.exports = new EmailService();