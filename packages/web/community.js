/**
 * iHuman Community Features
 * 
 * Enables:
 * - Skill showcase and discovery
 * - User profiles and contributions
 * - Community discussions
 * - Rating and reviews
 * - Leaderboards
 * - Contribution tracking
 */

const db = require('../db/connection');

/**
 * Skill Showcase
 */
class SkillShowcase {
  /**
   * Publish skill to community showcase
   */
  static async publishSkill(skillId, userId, showcaseData) {
    return db.insert('skill_showcase', {
      skill_id: skillId,
      user_id: userId,
      title: showcaseData.title,
      description: showcaseData.description,
      featured_image: showcaseData.featured_image,
      documentation_url: showcaseData.documentation_url,
      github_repo: showcaseData.github_repo,
      tags: showcaseData.tags || [],
      rating: 0,
      downloads: 0,
      is_featured: false,
      created_at: new Date()
    });
  }

  /**
   * Get featured skills
   */
  static async getFeaturedSkills(limit = 12, offset = 0) {
    return db.select(
      'skill_showcase',
      'is_featured = true ORDER BY rating DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }

  /**
   * Get trending skills
   */
  static async getTrendingSkills(days = 7, limit = 12) {
    const query = `
      SELECT ss.*, 
             COUNT(DISTINCT se.id) as recent_downloads,
             AVG(sr.rating) as avg_rating
      FROM skill_showcase ss
      LEFT JOIN skill_executions se ON ss.skill_id = se.skill_id 
        AND se.created_at > NOW() - INTERVAL '${days} days'
      LEFT JOIN skill_reviews sr ON ss.skill_id = sr.skill_id
      GROUP BY ss.id
      ORDER BY recent_downloads DESC
      LIMIT ?
    `;
    return db.query(query, [limit]);
  }

  /**
   * Search showcase
   */
  static async search(query, filters = {}) {
    let sql = `
      SELECT * FROM skill_showcase 
      WHERE (title ILIKE ? OR description ILIKE ?)
    `;
    const params = [`%${query}%`, `%${query}%`];

    if (filters.tags && filters.tags.length > 0) {
      sql += ` AND tags && ?`;
      params.push(filters.tags);
    }

    if (filters.minRating) {
      sql += ` AND rating >= ?`;
      params.push(filters.minRating);
    }

    sql += ` ORDER BY rating DESC LIMIT 50`;
    return db.query(sql, params);
  }

  /**
   * Update showcase stats
   */
  static async incrementDownloads(skillId) {
    return db.query(
      'UPDATE skill_showcase SET downloads = downloads + 1 WHERE skill_id = ?',
      [skillId]
    );
  }
}

/**
 * User Profiles & Contributions
 */
class UserProfile {
  /**
   * Create user profile
   */
  static async createProfile(userId, profileData) {
    return db.insert('user_profiles', {
      user_id: userId,
      bio: profileData.bio || '',
      avatar_url: profileData.avatar_url,
      website: profileData.website,
      social_links: profileData.social_links || {},
      location: profileData.location,
      skills_created: 0,
      skills_contributed: 0,
      total_executions: 0,
      reputation_score: 0,
      badges: [],
      created_at: new Date()
    });
  }

  /**
   * Get user profile
   */
  static async getProfile(userId) {
    return db.selectOne('user_profiles', 'user_id = ?', [userId]);
  }

  /**
   * Get user's created skills
   */
  static async getUserCreatedSkills(userId, limit = 20, offset = 0) {
    return db.query(
      `SELECT s.* FROM skills s
       JOIN skill_showcase ss ON s.id = ss.skill_id
       WHERE ss.user_id = ?
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
  }

  /**
   * Get user's contributions
   */
  static async getUserContributions(userId, limit = 20, offset = 0) {
    return db.query(
      `SELECT * FROM user_contributions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
  }

  /**
   * Add badge to user
   */
  static async addBadge(userId, badge) {
    const profile = await this.getProfile(userId);
    const badges = profile.badges || [];
    
    if (!badges.includes(badge)) {
      badges.push(badge);
      await db.update('user_profiles', { badges }, 'user_id = ?', [userId]);
    }
  }

  /**
   * Update reputation score
   */
  static async updateReputation(userId, points) {
    return db.query(
      `UPDATE user_profiles 
       SET reputation_score = reputation_score + ?
       WHERE user_id = ?`,
      [points, userId]
    );
  }
}

/**
 * Community Discussions
 */
class Discussion {
  /**
   * Create discussion thread
   */
  static async createThread(skillId, userId, title, content) {
    const threadId = await db.insert('discussion_threads', {
      skill_id: skillId,
      user_id: userId,
      title,
      content,
      reply_count: 0,
      view_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Award points to creator
    await UserProfile.updateReputation(userId, 5);
    
    return threadId;
  }

  /**
   * Post reply to thread
   */
  static async postReply(threadId, userId, content) {
    const replyId = await db.insert('discussion_replies', {
      thread_id: threadId,
      user_id: userId,
      content,
      helpful_count: 0,
      created_at: new Date()
    });

    // Increment reply count
    await db.query(
      `UPDATE discussion_threads SET reply_count = reply_count + 1
       WHERE id = ?`,
      [threadId]
    );

    // Award points to replier
    await UserProfile.updateReputation(userId, 2);

    return replyId;
  }

  /**
   * Get thread with replies
   */
  static async getThread(threadId) {
    const thread = await db.selectOne('discussion_threads', 'id = ?', [threadId]);
    
    const replies = await db.query(
      `SELECT dr.*, u.username, u.avatar_url
       FROM discussion_replies dr
       JOIN users u ON dr.user_id = u.id
       WHERE dr.thread_id = ?
       ORDER BY dr.created_at ASC`,
      [threadId]
    );

    // Increment view count
    await db.query(
      `UPDATE discussion_threads SET view_count = view_count + 1
       WHERE id = ?`,
      [threadId]
    );

    return { ...thread, replies };
  }

  /**
   * Get skill discussions
   */
  static async getSkillDiscussions(skillId, limit = 20, offset = 0) {
    return db.query(
      `SELECT dt.*, u.username, u.avatar_url,
              COUNT(DISTINCT dr.id) as reply_count
       FROM discussion_threads dt
       JOIN users u ON dt.user_id = u.id
       LEFT JOIN discussion_replies dr ON dt.id = dr.thread_id
       WHERE dt.skill_id = ?
       GROUP BY dt.id, u.id
       ORDER BY dt.updated_at DESC
       LIMIT ? OFFSET ?`,
      [skillId, limit, offset]
    );
  }

  /**
   * Mark reply as helpful
   */
  static async markHelpful(replyId) {
    await db.query(
      `UPDATE discussion_replies SET helpful_count = helpful_count + 1
       WHERE id = ?`,
      [replyId]
    );
  }
}

/**
 * Ratings & Reviews
 */
class Review {
  /**
   * Submit review
   */
  static async submitReview(skillId, userId, rating, reviewText) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const result = await db.insert('skill_reviews', {
      skill_id: skillId,
      user_id: userId,
      rating,
      review_text: reviewText,
      helpful_count: 0,
      created_at: new Date()
    });

    // Update skill average rating
    await this.updateSkillRating(skillId);

    // Award points
    await UserProfile.updateReputation(userId, 3);

    return result;
  }

  /**
   * Update skill average rating
   */
  static async updateSkillRating(skillId) {
    const result = await db.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
       FROM skill_reviews WHERE skill_id = ?`,
      [skillId]
    );

    if (result.length > 0) {
      await db.update(
        'skills',
        { 
          rating: Math.round(result[0].avg_rating * 10) / 10,
          review_count: result[0].review_count
        },
        'id = ?',
        [skillId]
      );
    }
  }

  /**
   * Get skill reviews
   */
  static async getSkillReviews(skillId, limit = 20, offset = 0) {
    return db.query(
      `SELECT sr.*, u.username, u.avatar_url
       FROM skill_reviews sr
       JOIN users u ON sr.user_id = u.id
       WHERE sr.skill_id = ?
       ORDER BY sr.helpful_count DESC, sr.created_at DESC
       LIMIT ? OFFSET ?`,
      [skillId, limit, offset]
    );
  }

  /**
   * Mark review as helpful
   */
  static async markHelpful(reviewId) {
    await db.query(
      `UPDATE skill_reviews SET helpful_count = helpful_count + 1
       WHERE id = ?`,
      [reviewId]
    );
  }
}

/**
 * Leaderboards
 */
class Leaderboard {
  /**
   * Get top contributors by reputation
   */
  static async getTopContributors(limit = 20) {
    return db.query(
      `SELECT u.id, u.username, u.avatar_url, up.reputation_score, 
              up.skills_created, up.total_executions
       FROM users u
       JOIN user_profiles up ON u.id = up.user_id
       ORDER BY up.reputation_score DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get most active users
   */
  static async getMostActive(limit = 20, period = '7 days') {
    return db.query(
      `SELECT u.id, u.username, u.avatar_url,
              COUNT(DISTINCT e.id) as executions,
              COUNT(DISTINCT dt.id) as discussions
       FROM users u
       LEFT JOIN executions e ON u.id = e.user_id 
         AND e.created_at > NOW() - INTERVAL '${period}'
       LEFT JOIN discussion_threads dt ON u.id = dt.user_id
         AND dt.created_at > NOW() - INTERVAL '${period}'
       GROUP BY u.id
       ORDER BY executions DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get trending skills leaderboard
   */
  static async getTrendingSkillsLeaderboard(limit = 20) {
    return db.query(
      `SELECT s.id, s.title, s.category,
              COUNT(e.id) as recent_executions,
              AVG(sr.rating) as avg_rating,
              u.username as creator
       FROM skills s
       LEFT JOIN executions e ON s.id = e.skill_id 
         AND e.created_at > NOW() - INTERVAL '7 days'
       LEFT JOIN skill_reviews sr ON s.id = sr.skill_id
       LEFT JOIN users u ON s.created_by = u.id
       GROUP BY s.id, u.id
       ORDER BY recent_executions DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get user leaderboard position
   */
  static async getUserRank(userId) {
    const result = await db.query(
      `SELECT user_id, reputation_score,
              RANK() OVER (ORDER BY reputation_score DESC) as rank
       FROM user_profiles
       WHERE user_id = ?`,
      [userId]
    );

    return result.length > 0 ? result[0] : null;
  }
}

/**
 * Community Statistics
 */
class CommunityStats {
  /**
   * Get overall community statistics
   */
  static async getOverallStats() {
    const [totalUsers, totalSkills, totalExecutions, totalDiscussions] = await Promise.all([
      db.count('users', ''),
      db.count('skills', 'is_active = true'),
      db.count('executions', 'status = \'completed\''),
      db.count('discussion_threads', '')
    ]);

    return {
      totalUsers,
      totalSkills,
      totalExecutions,
      totalDiscussions,
      timestamp: new Date()
    };
  }

  /**
   * Get community activity
   */
  static async getActivityChart(days = 30) {
    return db.query(
      `SELECT DATE(created_at) as date,
              COUNT(CASE WHEN type = 'execution' THEN 1 END) as executions,
              COUNT(CASE WHEN type = 'discussion' THEN 1 END) as discussions,
              COUNT(CASE WHEN type = 'review' THEN 1 END) as reviews
       FROM (
         SELECT created_at, 'execution' as type FROM executions
         UNION ALL
         SELECT created_at, 'discussion' as type FROM discussion_threads
         UNION ALL
         SELECT created_at, 'review' as type FROM skill_reviews
       ) activity
       WHERE created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      []
    );
  }
}

module.exports = {
  SkillShowcase,
  UserProfile,
  Discussion,
  Review,
  Leaderboard,
  CommunityStats
};
