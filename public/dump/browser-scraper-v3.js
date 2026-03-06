/**
 * Instagram Browser-Based Scraper V3 - Internal Data Extraction
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome, navigate to target profile
 * 2. Press F12, go to Console tab
 * 3. Paste this script and press Enter
 * 4. Choose mode: "quick" or "full"
 */

(function() {
  var log = function(msg) {
    var time = new Date().toISOString();
    console.log('[' + time.substring(11, 19) + '] ' + msg);
  };

  var sleep = function(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  };

  var getPostLinks = function() {
    var links = document.querySelectorAll('a[href*="/p/"]');
    var result = [];
    var seen = {};

    for (var i = 0; i < links.length; i++) {
      var href = links[i].href;
      if (href && href.indexOf('/p/') !== -1) {
        var match = href.match(/\/p\/([^\/\?#]+)/);
        if (match && !seen[match[1]]) {
          seen[match[1]] = true;
          result.push(href);
        }
      }
    }
    return result;
  };

  var getInstagramData = function() {
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var text = scripts[i].textContent || '';
      if (text && text.length > 10000) {
        if (text.indexOf('additional') !== -1 || text.indexOf('edge_owner_to_timeline') !== -1) {
          return text;
        }
      }
    }
    return null;
  };

  var extractCaption = function(pageSource, postUrl) {
    var match = postUrl.match(/\/p\/([^\/\?#]+)/);
    if (!match || !match[1]) return '';
    var shortcode = match[1];

    var patterns = ['"shortcode":"' + shortcode + '"', '"code":"' + shortcode + '"', '"' + shortcode + '"'];
    var scIdx = -1;

    for (var p = 0; p < patterns.length; p++) {
      scIdx = pageSource.indexOf(patterns[p]);
      if (scIdx !== -1) break;
    }

    if (scIdx === -1) return '';

    var start = Math.max(0, scIdx - 2000);
    var snippet = pageSource.substring(start, scIdx + 15000);

    var caption = '';

    var capIdx = snippet.indexOf('"caption":');
    if (capIdx !== -1) {
      var capSnippet = snippet.substring(capIdx, capIdx + 5000);
      var textMatch = capSnippet.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (textMatch && textMatch[1]) {
        try {
          caption = JSON.parse('"' + textMatch[1] + '"');
          log('  ✓ caption.text (' + caption.length + ' chars)');
        } catch (e) {
          caption = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          log('  ✓ caption.text (' + caption.length + ' chars) escaped');
        }
      }
    }

    if (!caption && snippet.indexOf('"edge_media_to_caption"') !== -1) {
      var edgeIdx = snippet.indexOf('"edge_media_to_caption"');
      var edgeSnippet = snippet.substring(edgeIdx, edgeIdx + 5000);
      var edgeMatch = edgeSnippet.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (edgeMatch && edgeMatch[1]) {
        try {
          caption = JSON.parse('"' + edgeMatch[1] + '"');
        } catch (e) {
          caption = edgeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        log('  ✓ edge_media_to_caption (' + caption.length + ' chars)');
      }
    }

    if (!caption) {
      var firstMatch = snippet.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (firstMatch && firstMatch[1]) {
        try {
          caption = JSON.parse('"' + firstMatch[1] + '"');
        } catch (e) {
          caption = firstMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        log('  ✓ first text (' + caption.length + ' chars)');
      }
    }

    if (!caption) {
      log('  ⚠ No caption: found');
    }

    return caption;
  };

  var extractPhones = function(text) {
    if (!text) return [];
    var phones = {};
    var patterns = [
      /(\+62|62|0)[0-9]{8,12}/g,
      /(\+62|62|0)?[0-9]{3,4}-[0-9]{4}-[0-9]{4}/g,
      /(\+62|62|0)?[0-9]{3,4}\s[0-9]{4}\s[0-9]{4}/g
    ];

    for (var i = 0; i < patterns.length; i++) {
      var matches = text.match(patterns[i]);
      if (matches) {
        for (var j = 0; j < matches.length; j++) {
          var clean = matches[j].replace(/[\s-]/g, '');
          phones[clean] = true;
        }
      }
    }

    return Object.keys(phones);
  };

  var extractEmails = function(text) {
    if (!text) return [];
    var emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(emailPattern) || [];
  };

  var scrapePosts = function(startIndex, endIndex) {
    log('=== Scraping from Internal Data ===');

    var pageSource = getInstagramData();
    if (!pageSource) {
      log('⚠ No Instagram data found in page');
      return Promise.resolve(false);
    }

    log('✓ Found data: ' + pageSource.length.toLocaleString() + ' chars');

    var urls = [];
    for (var i = startIndex; i <= endIndex && i < collectedUrls.length; i++) {
      urls.push(collectedUrls[i]);
    }

    if (urls.length === 0) {
      log('⚠ No posts in range');
      return Promise.resolve(false);
    }

    log('Will scrape ' + urls.length + ' posts...');

    var promise = Promise.resolve();

    for (var k = 0; k < urls.length; k++) {
      promise = promise.then(function(idx, url) {
        return function() {
          log('');
          log('[' + idx + '] ' + url);

          var caption = extractCaption(pageSource, url);

          var postData = {
            index: idx,
            url: url,
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
            var hashtags = caption.match(/#[\w]+/g) || [];
            postData.hashtags = hashtags;

            var mentions = caption.match(/@[\w.]+/g) || [];
            postData.mentions = mentions;

            postData.phones = extractPhones(caption);
            postData.emails = extractEmails(caption);

            var dateMatch = caption.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              postData.date = dateMatch[1];
            }

            log('  ✓ Caption: ' + caption.substring(0, 50) + '...');
          }

          scrapedPosts.push(postData);
          return sleep(300);
        }();
      }(k, urls[k]));
    }

    return promise.then(function() {
      return true;
    });
  };

  var runScroll = function(targetCount) {
    log('=== Scrolling to Load Posts ===');
    log('Target: ' + targetCount + ' scrolls');

    return new Promise(function(resolve) {
      function doScroll() {
        if (lazyLoadingEncounters >= targetCount) {
          log('✓ Scroll complete! ' + collectedUrls.length + ' posts');
          resolve();
          return;
        }

        window.scrollTo(0, document.body.scrollHeight);
        sleep(3000).then(function() {
          lazyLoadingEncounters++;

          var links = getPostLinks();
          collectedUrls.length = 0;
          for (var i = 0; i < links.length; i++) {
            collectedUrls.push(links[i]);
          }

          var percent = Math.round((lazyLoadingEncounters / targetCount) * 100);
          var bar = '';
          for (var b = 0; b < 25; b++) {
            bar += percent / 4 > b ? '█' : '░';
          }
          document.title = bar + ' ' + percent + '% | ' + lazyLoadingEncounters + '/' + targetCount + ' | Posts: ' + collectedUrls.length;

          if (lazyLoadingEncounters % 10 === 0) {
            log('Progress: ' + lazyLoadingEncounters + '/' + targetCount + ' | Posts: ' + collectedUrls.length);
          }

          doScroll();
        });
      }

      doScroll();
    });
  };

  var saveResults = function() {
    var results = {
      metadata: {
        targetUsername: targetUsername,
        lazyLoadingCount: lazyLoadingEncounters,
        scrapeStartIndex: scrapeStartIndex,
        scrapeEndIndex: scrapeEndIndex,
        totalPostsLoaded: collectedUrls.length,
        totalPostsScraped: scrapedPosts.length,
        completedAt: new Date().toISOString()
      },
      posts: scrapedPosts,
      allPostUrls: collectedUrls
    };

    try {
      var key = 'instagram_scraper_results_' + Date.now();
      localStorage.setItem(key, JSON.stringify(results));
      localStorage.setItem('instagram_scraper_latest',', key);
      log('✓ Saved to localStorage');
    } catch (e) {
      log('⚠ localStorage error: ' + e.message);
    }

    try {
      var str = JSON.stringify(results, null, 2);
      var blob = new Blob([str], {type: 'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'instagram-scraper-' + targetUsername + '-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
      log('📥 Downloaded JSON');
    } catch (e) {
      log('⚠ Download error: ' + e.message);
    }

    return results;
  };

  var showSummary = function(results) {
    log('');
    log('=== Complete ===');
    log('Posts loaded: ' + results.metadata.totalPostsLoaded);
    log('Posts scraped: ' + results.metadata.totalPostsScraped);

    var success = 0;
    var allPhones = {};
    var allEmails = {};

    for (var i = 0; i < results.posts.length; i++) {
      var post = results.posts[i];
      if (post.success) {
        success++;
        for (var j = 0; j < post.phones.length; j++) {
          allPhones[post.phones[j]] = true;
        }
        for (var k = 0; k < post.emails.length; k++) {
          allEmails[post.emails[k]] = true;
        }
      }
    }

    log('');
    log('📊 Summary:');
    log('Success: ' + success + '/' + results.posts.length);
    log('Phones: ' + Object.keys(allPhones).length);
    log('Emails: ' + Object.keys(allEmails).length);

    log('');
    log('💾 Next: Check downloaded JSON file');

    document.title = 'Instagram';
  };

  // Variables
  var lazyLoadingEncounters = 0;
  var targetLazyCount = 0;
  var scrapeStartIndex = 0;
  var scrapeEndIndex = 11;
  var targetUsername = '';
  var collectedUrls = [];
  var scrapedPosts = [];

  // Main
  (function() {
    log('=== Instagram Scraper V3 ===');
    log('');

    if (window.location.href.indexOf('instagram.com') === -1) {
      log('❌ ERROR: Navigate to Instagram profile first!');
      return;
    }

    var match = window.location.href.match(/instagram\.com\/([^\/\?#]+)/);
    if (match) {
      targetUsername = match[1];
      log('Profile: @' + targetUsername);
    }

    var links = getPostLinks();
    for (var i = 0; i < links.length; i++) {
      collectedUrls.push(links[i]);
    }

    log('Current posts: ' + links.length);

    var mode = prompt(
      'Mode:\n' +
      '  quick = Scrape current posts (no scroll)\n' +
      '  full = Scroll + scrape\n\n' +
      'Enter: quick or full',
      'quick'
    );

    if (mode === 'quick') {
      log('');
      log('🚀 Quick Mode');
      log('');

      var range = prompt(
        'How many posts? (0-' + (links.length - 1) + ')',
        String(Math.min(11, links.length - 1))
      );

      scrapeEndIndex = parseInt(range) || Math.min(11, links.length - 1);

      scrapePosts(0, scrapeEndIndex).then(function(ok) {
        if (ok) {
          var results = saveResults();
          showSummary(results);
        }
      });

    } else {
      var scrollCount = prompt(
        'How many scrolls?\n' +
        '  100 = ~400-500 posts\n' +
        '  200 = ~800-1000 posts\n',
        '200'
      );

      targetLazyCount = parseInt(scrollCount) || 200;

      log('');
      log('Configuration: ' + targetLazyCount + ' scrolls');
      log('');

      runScroll(targetLazyCount).then(function() {
        var range = prompt(
          collectedUrls.length + ' posts loaded.\n\n' +
          'Scrape range? (0-' + (collectedUrls.length - 1) + ')',
          '0-' + Math.min(50, collectedUrls.length - 1)
        );

        if (range) {
          var rangeMatch = range.match(/^(\d+)-(\d+)$/);
          if (rangeMatch) {
            scrapeStartIndex = parseInt(rangeMatch[1]);
            scrapeEndIndex = parseInt(rangeMatch[2]);
          }
        }

        log('');
        log('Scraping ' + scrapeStartIndex + ' to ' + scrapeEndIndex + '...');

        scrapePosts(scrapeStartIndex, scrapeEndIndex).then(function(ok) {
          if (ok) {
            var results = saveResults();
            showSummary(results);
          }
        });
      });
    }
  })();

})();
