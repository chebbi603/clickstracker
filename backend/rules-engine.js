const Database = require('./database');

class RulesEngine {
  constructor(db) {
    this.db = db;
    this.rules = {
      lowClickRate: {
        name: 'Low Click Rate',
        description: 'Identifies buttons/links with low click rates relative to page views',
        thresholds: {
          minClickRate: 0.05, // 5% click rate minimum
          minPageViews: 10     // minimum page views to consider
        },
        severity: 'medium'
      },
      lowScrollDepth: {
        name: 'Low Scroll Depth',
        description: 'Identifies pages where users scroll less than expected',
        thresholds: {
          maxScrollDepth: 30,  // less than 30% scroll depth
          minSessions: 5       // minimum sessions to consider
        },
        severity: 'low'
      },
      rageClicks: {
        name: 'Rage Clicks',
        description: 'Identifies elements with multiple rapid clicks indicating frustration',
        thresholds: {
          clicksInWindow: 3,   // 3+ clicks
          timeWindow: 2000,    // within 2 seconds
          minOccurrences: 2    // at least 2 sessions with rage clicks
        },
        severity: 'high'
      },
      deadClicks: {
        name: 'Dead Clicks',
        description: 'Identifies non-interactive elements being clicked frequently',
        thresholds: {
          minClicksOnNonInteractive: 5,
          nonInteractiveSelectors: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
        },
        severity: 'medium'
      },
      highExitRate: {
        name: 'High Exit Rate',
        description: 'Identifies pages with high exit rates without significant interaction',
        thresholds: {
          maxInteractionTime: 10000, // less than 10 seconds
          minSessions: 5
        },
        severity: 'medium'
      }
    };

    this.suggestions = {
      lowClickRate: [
        'Consider making the button more prominent with better contrast or size',
        'Review button placement - move critical actions above the fold',
        'Test different button text or calls-to-action',
        'Add visual affordances like hover effects or icons',
        'Ensure the button purpose is clear from surrounding context'
      ],
      lowScrollDepth: [
        'Add engaging content above the fold to encourage scrolling',
        'Use visual cues like arrows or gradients to indicate more content below',
        'Break up long content with images, videos, or interactive elements',
        'Consider sticky navigation or progress indicators',
        'Review page loading speed - slow pages discourage scrolling'
      ],
      rageClicks: [
        'Check if the element should be interactive - add proper click handlers',
        'Improve loading feedback - add spinners or disable buttons during processing',
        'Ensure click targets are large enough (minimum 44px)',
        'Fix any JavaScript errors that might prevent proper interaction',
        'Add clear visual feedback when elements are clicked'
      ],
      deadClicks: [
        'Remove click events from non-interactive elements',
        'Style interactive elements to look clickable (buttons, links)',
        'Add proper semantic HTML - use buttons instead of divs for actions',
        'Ensure consistent interaction patterns across the interface',
        'Consider if users expect these elements to be interactive'
      ],
      highExitRate: [
        'Improve page loading speed and performance',
        'Ensure the page content matches user expectations from the entry point',
        'Add clear navigation and breadcrumbs',
        'Include engaging content or clear calls-to-action early on the page',
        'Review and improve the page\'s value proposition'
      ]
    };
  }

  async analyzeAllRules() {
    const issues = [];
    
    try {
      // Run all rule analyses in parallel for better performance
      const [
        lowClickRateIssues,
        lowScrollDepthIssues,
        rageClickIssues,
        deadClickIssues,
        highExitRateIssues
      ] = await Promise.all([
        this.analyzeLowClickRate(),
        this.analyzeLowScrollDepth(),
        this.analyzeRageClicks(),
        this.analyzeDeadClicks(),
        this.analyzeHighExitRate()
      ]);

      issues.push(
        ...lowClickRateIssues,
        ...lowScrollDepthIssues,
        ...rageClickIssues,
        ...deadClickIssues,
        ...highExitRateIssues
      );

      // Add suggestions to each issue
      issues.forEach(issue => {
        issue.suggestions = this.getSuggestionsForRule(issue.ruleId);
        issue.detectedAt = new Date().toISOString();
      });

      return issues;
    } catch (error) {
      console.error('Error analyzing rules:', error);
      throw error;
    }
  }

  async analyzeLowClickRate() {
    const { minClickRate, minPageViews } = this.rules.lowClickRate.thresholds;
    
    const query = `
      WITH page_session_counts AS (
        SELECT page_url, COUNT(DISTINCT session_id) AS page_sessions
        FROM events
        GROUP BY page_url
      )
      SELECT 
        e.element_selector,
        e.page_url,
        COUNT(*) as clicks,
        COUNT(DISTINCT e.session_id) as unique_sessions,
        p.page_sessions as page_sessions,
        (COUNT(DISTINCT e.session_id) * 1.0) / p.page_sessions as click_rate
      FROM events e
      JOIN page_session_counts p ON p.page_url = e.page_url
      WHERE e.event_type = 'click' 
        AND e.element_selector IS NOT NULL
        AND e.element_selector != ''
      GROUP BY e.element_selector, e.page_url, p.page_sessions
      HAVING p.page_sessions >= ? AND ((COUNT(DISTINCT e.session_id) * 1.0) / p.page_sessions) < ?
      ORDER BY click_rate ASC, clicks DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.db.all(query, [minPageViews, minClickRate], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const issues = rows.map(row => ({
          id: `low-click-rate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'lowClickRate',
          ruleName: this.rules.lowClickRate.name,
          severity: this.rules.lowClickRate.severity,
          elementSelector: row.element_selector,
          pageUrl: row.page_url,
          description: `Low click rate (${(row.click_rate * 100).toFixed(1)}%) on "${row.element_selector}"`,
          metrics: {
            clickRate: row.click_rate,
            clicks: row.clicks,
            uniqueSessions: row.unique_sessions,
            pageSessions: row.page_sessions
          }
        }));

        resolve(issues);
      });
    });
  }

  async analyzeLowScrollDepth() {
    const { maxScrollDepth, minSessions } = this.rules.lowScrollDepth.thresholds;
    
    const query = `
      SELECT 
        page_url,
        COUNT(DISTINCT session_id) as sessions,
        AVG(CAST(scroll_depth AS FLOAT)) as avg_scroll_depth,
        MAX(scroll_depth) as max_scroll_depth
      FROM events 
      WHERE event_type = 'scroll' 
        AND scroll_depth IS NOT NULL
      GROUP BY page_url
      HAVING sessions >= ? AND avg_scroll_depth < ?
      ORDER BY avg_scroll_depth ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.db.all(query, [minSessions, maxScrollDepth], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const issues = rows.map(row => ({
          id: `low-scroll-depth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'lowScrollDepth',
          ruleName: this.rules.lowScrollDepth.name,
          severity: this.rules.lowScrollDepth.severity,
          elementSelector: null,
          pageUrl: row.page_url,
          description: `Low average scroll depth (${row.avg_scroll_depth.toFixed(1)}%) on page`,
          metrics: {
            avgScrollDepth: row.avg_scroll_depth,
            maxScrollDepth: row.max_scroll_depth,
            sessions: row.sessions
          }
        }));

        resolve(issues);
      });
    });
  }

  async analyzeRageClicks() {
    const { clicksInWindow, timeWindow, minOccurrences } = this.rules.rageClicks.thresholds;
    
    // Complex query to find rapid successive clicks
    const query = `
      WITH rage_click_sessions AS (
        SELECT 
          session_id,
          element_selector,
          page_url,
          COUNT(*) as rapid_clicks
        FROM (
          SELECT 
            e1.session_id,
            e1.element_selector,
            e1.page_url,
            e1.timestamp,
            COUNT(e2.timestamp) as clicks_in_window
          FROM events e1
          JOIN events e2 ON 
            e1.session_id = e2.session_id 
            AND e1.element_selector = e2.element_selector
            AND e2.timestamp BETWEEN e1.timestamp AND e1.timestamp + ?
          WHERE e1.event_type = 'click' 
            AND e2.event_type = 'click'
            AND e1.element_selector IS NOT NULL
          GROUP BY e1.session_id, e1.element_selector, e1.timestamp
          HAVING clicks_in_window >= ?
        ) rapid_sequences
        GROUP BY session_id, element_selector, page_url
      )
      SELECT 
        element_selector,
        page_url,
        COUNT(*) as affected_sessions,
        SUM(rapid_clicks) as total_rage_clicks,
        AVG(rapid_clicks) as avg_rage_clicks_per_session
      FROM rage_click_sessions
      GROUP BY element_selector, page_url
      HAVING affected_sessions >= ?
      ORDER BY affected_sessions DESC, total_rage_clicks DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.db.all(query, [timeWindow, clicksInWindow, minOccurrences], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const issues = rows.map(row => ({
          id: `rage-clicks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'rageClicks',
          ruleName: this.rules.rageClicks.name,
          severity: this.rules.rageClicks.severity,
          elementSelector: row.element_selector,
          pageUrl: row.page_url,
          description: `Rage clicks detected on "${row.element_selector}" (${row.affected_sessions} sessions affected)`,
          metrics: {
            affectedSessions: row.affected_sessions,
            totalRageClicks: row.total_rage_clicks,
            avgRageClicksPerSession: row.avg_rage_clicks_per_session
          }
        }));

        resolve(issues);
      });
    });
  }

  async analyzeDeadClicks() {
    const { minClicksOnNonInteractive, nonInteractiveSelectors } = this.rules.deadClicks.thresholds;
    
    // Create placeholders for the IN clause
    const placeholders = nonInteractiveSelectors.map(() => '?').join(',');
    
    const query = `
      SELECT 
        element_selector,
        page_url,
        COUNT(*) as clicks,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM events 
      WHERE event_type = 'click' 
        AND element_selector IS NOT NULL
        AND (${nonInteractiveSelectors.map(sel => `element_selector LIKE '${sel}%'`).join(' OR ')})
      GROUP BY element_selector, page_url
      HAVING clicks >= ?
      ORDER BY clicks DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.db.all(query, [minClicksOnNonInteractive], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const issues = rows.map(row => ({
          id: `dead-clicks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'deadClicks',
          ruleName: this.rules.deadClicks.name,
          severity: this.rules.deadClicks.severity,
          elementSelector: row.element_selector,
          pageUrl: row.page_url,
          description: `Dead clicks on non-interactive element "${row.element_selector}" (${row.clicks} clicks)`,
          metrics: {
            clicks: row.clicks,
            uniqueSessions: row.unique_sessions
          }
        }));

        resolve(issues);
      });
    });
  }

  async analyzeHighExitRate() {
    const { maxInteractionTime, minSessions } = this.rules.highExitRate.thresholds;
    
    const query = `
      WITH session_durations AS (
        SELECT 
          page_url,
          session_id,
          (MAX(timestamp) - MIN(timestamp)) AS duration
        FROM events
        GROUP BY page_url, session_id
      )
      SELECT 
        page_url,
        COUNT(*) as sessions,
        SUM(CASE WHEN duration <= ? THEN 1 ELSE 0 END) as quick_exit_sessions,
        (SUM(CASE WHEN duration <= ? THEN 1 ELSE 0 END) * 1.0) / COUNT(*) as exit_rate
      FROM session_durations
      GROUP BY page_url
      HAVING COUNT(*) >= ? AND exit_rate > 0.5
      ORDER BY exit_rate DESC, sessions DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.db.all(query, [maxInteractionTime, maxInteractionTime, minSessions], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const issues = rows.map(row => ({
          id: `high-exit-rate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'highExitRate',
          ruleName: this.rules.highExitRate.name,
          severity: this.rules.highExitRate.severity,
          elementSelector: null,
          pageUrl: row.page_url,
          description: `High exit rate (${(row.exit_rate * 100).toFixed(1)}%) with minimal interaction`,
          metrics: {
            exitRate: row.exit_rate,
            sessions: row.sessions,
            quickExitSessions: row.quick_exit_sessions
          }
        }));

        resolve(issues);
      });
    });
  }

  getSuggestionsForRule(ruleId) {
    const suggestions = this.suggestions[ruleId] || [];
    // Return 2-3 most relevant suggestions to avoid overwhelming users
    return suggestions.slice(0, 3).map((text, index) => ({
      id: `suggestion-${ruleId}-${index}`,
      text,
      priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low'
    }));
  }

  // Configuration methods
  updateRuleThreshold(ruleId, thresholdKey, value) {
    if (this.rules[ruleId] && this.rules[ruleId].thresholds[thresholdKey] !== undefined) {
      this.rules[ruleId].thresholds[thresholdKey] = value;
      return true;
    }
    return false;
  }

  getRuleConfiguration() {
    return Object.entries(this.rules).map(([id, rule]) => ({
      id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      thresholds: rule.thresholds
    }));
  }
}

module.exports = RulesEngine;