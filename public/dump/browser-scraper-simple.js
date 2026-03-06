/**
 * Instagram Browser Scraper - SIMPLE VERSION
 *
 * Scrolls to collect post URLs, then extracts captions directly from profile page
 * No popup windows, no navigation - works on profile page
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome, navigate to target profile
 * 2. Scroll to load posts (manually or use existing scroll)
 * 3. Run scraper to extract captions
 * 4. View results and download JSON
 */

(function() {
  console.log('=== SIMPLE INSTAGRAM SCRAPER ===\n');

  // Check on Instagram
  if (window.location.href.indexOf('instagram.com') === -1) {
    console.log('ERROR: Please navigate to Instagram profile first!');
    console.log('Example: instagram.com/infolomba');
    return;
  }

  console.log('OK: On Instagram page');
  console.log('URL:', window.location.href);

  // Configuration
  var SCROLL_WAIT = 3000;

  var collectedUrls = [];
  var scrapedPosts = [];

  // Helper functions
  var log = function(msg) {
    var time = new Date().toISOString();
    console.log('[' + time.substring(11, 19) + '] ' + msg);
  };

  var updateTitle = function(text) {
    document.title = text;
  };

  var scrollToBottom = function() {
    window.scrollTo(0, document.body.scrollHeight);
  };

  var sleep = function(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  };

  var extractPhones = function(text) {
    if (!text) return [];
    var phones = {};
    var patterns = [
      /(\+62|62|0)[0-9]{8,12}/g,
      /(\+62|62|0)?:[0-9]{3,4}-[0-9]{4}-[0-9]{4}/g,
      /(\+62|62|0)?[0-9]{3,4}\s[0-9]{4}\s[0-9]{4}/g
    ];

    for (var p = 0; p < patterns.length; p++) {
      var matches = text.match(patterns[p]);
      if (matches) {
        for (var m = 0; m < matches.length; m++) {
          var clean = matches[m].replace(/[\s-]/g, '');
          phones[clean] = true;
        }
      }
    }

    return Object.keys(phones);
  };

  var extractEmails = function(text) {
    if (!text) return [];
    var pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(pattern) || [];
  };

  var extractDate = function(text) {
    if (!text) return null;
    var match = text.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  var extractCaptionsFromPage = function() {
    console.log('Extracting captions from current page...');

    var captions = [];

    // Method 1: Parse all script tags for Instagram data
    var scripts = document.getElementsByTagName('script');

    for (var s = 0; s < scripts.length; s++) {
      var text = scripts[s] && scripts[s].textContent;

      if (!text || text.length < 10000) {
        continue;
      }

      log('Checking script ' + s + ' (' + text.length.toLocaleString() + ' chars)');

      // Try to parse as JSON
      try {
        var jsonData = JSON.parse(text);

        // Look for caption data in various places
        var findCaption = function(obj, path) {
          if (!obj) return null;

          var current = obj;
          for (var i = 0; i < path.length; i++) {
            var key = path[i];
            current = current[key];

            if (typeof current === 'string' && current.length > 50 && current.indexOf('text') === -1) {
              var caption = current;
              log('  Found caption at: ' + key + ' (' + caption.length + ' chars)');
              captions.push(caption);
            }
          }
        };

        // Check common structures for Instagram data
        if (jsonData.shortcode_media && jsonData.shortcode_media.edges) {
          log('Found shortcode_media.edges structure');
          for (var i = 0; i < jsonData.shortcode_media.edges.length; i++) {
            var edge = jsonData.shortcode_media.edges[i];
            if (edge.node && edge.node.edge_media_to_caption && edge.node.edge_media_to_caption.edges && edge.node.edge_media_to_caption.edges.length > 0) {
              var captionNode = edge.node.edge_media_to_caption.edges[0].node;
              if (captionNode && captionNode.text) {
                captions.push(captionNode.text);
                log('  Found caption in shortcode_media.edges[' + i + '] (' + captionNode.text.length + ' chars)');
              }
            }
          }
        }

        if (jsonData.graphql && jsonData.graphql.user) {
          log('Found graphql structure');
          if (jsonData.graphql.user) {
            var user = jsonData.graphql.user;
            if (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) {
              for (var j = 0; j < user.edge_owner_to_timeline_media.edges.length; j++) {
                var edge = user.edge_owner_to_timeline_media.edges[j];
                if (edge.node && edge.node.edge_media_to_caption && edge.node.edge_media_to_caption.edges.length > 0) {
                  var captionNode = edge.node.edge_media_to_caption.edges[0].node;
                  if (captionNode && captionNode.text) {
                    captions.push(captionNode.text);
                    log('Found caption in edge_owner_to_timeline_media.edges[' + j + '] (' + captionNode.text.length + ' chars)');
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        log('Script ' + s + ' not valid JSON: ' + e.message);
      }
    }

    // Method 2: Try DOM elements (fallback)
    if (captions.length === 0) {
      log('Trying DOM element extraction...');

      var h1s = document.getElementsByTagName('h1');
      var found = false;

      for (var i = 0; i < h1s.length; i++) {
        var text = h1s[i].innerText || '';
        if (text && text.length > 20 && text.length > found.length) {
          captions.push(text);
          found = true;
          log('Found h1 element: ' + text.length + ' chars)');
        }
      }

      if (found) {
        log('Using h1 elements');
      } else {
        log('Trying span elements...');
        var spans = document.querySelectorAll('span[dir="auto"]');

        for (var j = 0; j < spans.length; j++) {
          var text = spans[j].innerText || '';
          if (text && text.length > 20 && text.length > captions.length) {
            captions.push(text);
            log('Found span element ' + text.length + ' chars)');
          }
        }
      }
    }

    log('Found ' + captions.length + ' captions from current page');

    return captions;
  };

  var createPostData = function(caption, postUrl, index) {
    var postData = {
      index: index,
      url: postUrl,
      scrapedAt: new Date().toISOString(),
      success: caption && caption.length > 0,
      caption: caption || '',
      hashtags: [],
      mentions: [],
      phones: [],
      emails: [],
      imageUrl: '',
      videoUrl: '',
      likes: 0,
      comments: 0,
      date: null
    };

    if (caption) {
      postData.hashtags = caption.match(/#[\w]+/g) || [];
      postData.mentions = caption.match(/@[\w.]+/g) || [];
      postData.phones = extractPhones(caption);
      postData.emails = extractEmails(caption);
      postData.date = extractDate(caption);

      log('Caption: ' + caption.length + ' chars');
    } else {
      log('No caption for post');
    }

    return postData;
  };

  var saveResults = function() {
    var results = {
      metadata: {
        targetUsername: window.location.href.split('/').pop(),
        totalPostsLoaded: collectedUrls.length,
        totalPostsScraped: scrapedPosts.length,
        completedAt: new Date().toISOString()
      },
      posts: scrapedPosts,
      allPostUrls: collectedUrls
    };

    try {
      localStorage.setItem('instagram_scraper_simple', JSON.stringify(results));
      log('Saved to localStorage');
    } catch (e) {
      log('localStorage error: ' + e.message);
    }

    try {
      var str = JSON.stringify(results, null, 2);
      var blob = new Blob([str], {type: 'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'instagram-scraper-simple-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
      log('Downloaded JSON file');
    } catch (e) {
      log('Download error: ' + e.message);
    }

    return results;
  };

  var showSummary = function(results) {
    log('');
    log('=== COMPLETE ===');
    log('Posts loaded: ' + results.metadata.totalPostsLoaded);
    log('Posts scraped: ' + results.metadata.totalPostsScraped);

    var success = 0;
    var totalPhones = 0;
    var totalEmails = 0;

    for (var i = 0; i < results.posts.length; i++) {
      var post = results.posts[i];
      if (post.success) {
        success++;
        totalPhones += post.phones ? post.phones.length : 0;
        totalEmails += post.emails ? post.emails.length : 0;
      }
    }

    log('');
    log('Summary:');
    log('Success: ' + success + '/' + results.posts.length);
    log('Phones: ' + totalPhones);
    log('Emails: ' + totalEmails);
    log('');
    log('Next steps:');
    log('1. Check downloaded JSON file');
    log('2. Parse per MASTER_RULE.md to create /parsed/ CSV');
    log('3. Upload /parsed/ CSV to VPS CRM');

    updateTitle('Instagram');
  };

  var main = function() {
    // Get existing post links from current page
    var anchors = document.getElementsByTagName('a');
    var links = [];
    var seen = {};

    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].href;
      if (href && href.indexOf('/p/') !== -1) {
        var match = href.match(/\/p\/([^\/\?#]+)/);
        if (match && !seen[match[1]]) {
          seen[match[1]] = true;
          links.push(href);
        }
      }
    }

    log('Current posts on page: ' + links.length);
    console.log('');
    console.log('Would you like to:');
    console.log('1. Extract captions from current page? (Just run the simple scraper)');
    console.log('2. Extract from a scrolled page (Run scroll phase first, then run this scraper)');
    console.log('');
    console.log('Available actions:');
    console.log('- Run: Simple scraper below to extract from profile page');
    console.log('- Scroll: Manual scroll to load more posts');
    console.log('');
    console.log('Instructions for using:');
    console.log('1. Scroll down to load posts (manually)');
    console.log('2. Run this script (browser-scraper-simple.js)');
    console.log('3. Watch console for extraction logs');
    console.log('');
    console.log('The scraper will search for Instagram data in:');
    console.log('- script tags (JSON data with shortcodes)');
    console.log('- DOM elements (h1, span, etc)');
    console.log('');
    console.log('NOTICE: This uses same extraction logic as old scraper.');
    console.log('If this does not find captions, run scroll phase first.');
    console.log('');
    console.log('The scraper will NOT navigate to post pages.');
    console.log('It extracts directly from the already-loaded profile page.');
  console.log('');
    console.log('So if captions are truncated to "more", check these:');
    console.log('- Console logs will show the extraction methods used');
    console.log('- Instagram data structure may not include all captions in profile page');
  console.log('');
    console.log('IMPORTANT: This approach may NOT find full captions like:');
    console.log('- The old Selenium scraper navigated to EACH post page (separate load with all data)');
    console.log('- The profile page only contains some posts with partial data');
    console.log('');
    console.log('Please try it and let me know the results!');
  console.log('');
  console.log('After running, share console output if it works or not.');
  };

    updateTitle('Instagram');
  };

  main();
})();
