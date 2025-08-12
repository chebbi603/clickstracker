const Database = require('./database');

// Generate test data to demonstrate the rules engine
async function generateTestData() {
  const db = new Database();
  await db.init();

  console.log('Generating test data...');

  const testEvents = [];
  const baseTimestamp = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

  // Test Case 1: Low Click Rate - Create page views but very few clicks on CTA button
  for (let i = 0; i < 50; i++) {
    testEvents.push({
      sessionId: `session-low-click-${i}`,
      pageUrl: '/landing-page',
      eventType: 'scroll',
      elementSelector: null,
      clickX: null,
      clickY: null,
      scrollDepth: Math.random() * 80 + 20, // 20-100% scroll
      timestamp: baseTimestamp + i * 60000
    });
  }
  
  // Only 2 clicks on the CTA out of 50 sessions (4% click rate - below 5% threshold)
  for (let i = 0; i < 2; i++) {
    testEvents.push({
      sessionId: `session-low-click-${i}`,
      pageUrl: '/landing-page',
      eventType: 'click',
      elementSelector: 'button.cta-primary',
      clickX: 300,
      clickY: 200,
      scrollDepth: null,
      timestamp: baseTimestamp + i * 60000 + 30000
    });
  }

  // Test Case 2: Low Scroll Depth - Users barely scroll
  for (let i = 0; i < 20; i++) {
    testEvents.push({
      sessionId: `session-low-scroll-${i}`,
      pageUrl: '/blog-post',
      eventType: 'scroll',
      elementSelector: null,
      clickX: null,
      clickY: null,
      scrollDepth: Math.random() * 25, // 0-25% scroll (below 30% threshold)
      timestamp: baseTimestamp + i * 120000
    });
  }

  // Test Case 3: Rage Clicks - Multiple rapid clicks on same element
  const rageClickTimestamp = baseTimestamp + 1000000;
  for (let session = 0; session < 3; session++) {
    for (let click = 0; click < 5; click++) {
      testEvents.push({
        sessionId: `session-rage-${session}`,
        pageUrl: '/checkout',
        eventType: 'click',
        elementSelector: 'button.submit-order',
        clickX: 400 + Math.random() * 10,
        clickY: 300 + Math.random() * 10,
        scrollDepth: null,
        timestamp: rageClickTimestamp + session * 300000 + click * 500 // 500ms apart
      });
    }
  }

  // Test Case 4: Dead Clicks - Clicks on non-interactive elements
  for (let i = 0; i < 8; i++) {
    testEvents.push({
      sessionId: `session-dead-${i}`,
      pageUrl: '/product-page',
      eventType: 'click',
      elementSelector: 'div.product-image', // Non-interactive div
      clickX: 250 + Math.random() * 50,
      clickY: 150 + Math.random() * 50,
      scrollDepth: null,
      timestamp: baseTimestamp + i * 180000
    });
  }

  // Test Case 5: High Exit Rate - Quick exits with minimal interaction
  for (let i = 0; i < 15; i++) {
    // Session with very brief interaction (< 5 seconds)
    const sessionStart = baseTimestamp + i * 240000;
    testEvents.push({
      sessionId: `session-quick-exit-${i}`,
      pageUrl: '/pricing',
      eventType: 'scroll',
      elementSelector: null,
      clickX: null,
      clickY: null,
      scrollDepth: Math.random() * 10, // Very little scrolling
      timestamp: sessionStart
    });
    
    // Most sessions end within 3 seconds
    if (i < 12) {
      testEvents.push({
        sessionId: `session-quick-exit-${i}`,
        pageUrl: '/pricing',
        eventType: 'scroll',
        elementSelector: null,
        clickX: null,
        clickY: null,
        scrollDepth: Math.random() * 15,
        timestamp: sessionStart + 2000 // End after 2 seconds
      });
    }
  }

  // Add some normal behavior to contrast
  for (let i = 0; i < 10; i++) {
    const sessionId = `session-normal-${i}`;
    const sessionStart = baseTimestamp + i * 300000;
    
    // Normal scroll behavior
    testEvents.push({
      sessionId,
      pageUrl: '/homepage',
      eventType: 'scroll',
      elementSelector: null,
      clickX: null,
      clickY: null,
      scrollDepth: Math.random() * 40 + 60, // 60-100% scroll
      timestamp: sessionStart
    });
    
    // Normal click behavior
    testEvents.push({
      sessionId,
      pageUrl: '/homepage',
      eventType: 'click',
      elementSelector: 'a.nav-link',
      clickX: 150,
      clickY: 50,
      scrollDepth: null,
      timestamp: sessionStart + 5000
    });
  }

  console.log(`Inserting ${testEvents.length} test events...`);
  await db.insertEvents(testEvents);
 
  console.log('Test data generation complete!');
  console.log('Expected issues:');
  console.log('- Low Click Rate: button.cta-primary on /landing-page (4% click rate)');
  console.log('- Low Scroll Depth: /blog-post (avg ~12.5% scroll depth)');
  console.log('- Rage Clicks: button.submit-order on /checkout (3 sessions with 5 rapid clicks each)');
  console.log('- Dead Clicks: div.product-image on /product-page (8 clicks on non-interactive element)');
  console.log('- High Exit Rate: /pricing (12/15 sessions with quick exits)');
}

if (require.main === module) {
  generateTestData().catch(console.error);
}

module.exports = { generateTestData };