/**
 * Instagram Browser Scraper - FINAL VERSION
 *
 * Strategy:
 * 1. Scroll on profile to collect post URLs
 * 2. Open each post in NEW WINDOW to extract caption
 * 3. Close window, continue to next post
 */

(function() {
  console.log('=== INSTAGRAM SCRAPER FINAL ===');

  if (window.location.href.indexOf('instagram.com') === -1) {
    console.log('ERROR: Please navigate to Instagram profile first!');
    return;
  }

  console.log('OK: On Instagram page');
  console.log('URL:', window.location.href);

  var profileUrl = window.location.href;

  var SCROLL_WAIT = 3000;
  var POST_WAIT = 4000;

  var lazyCount = 0;
  var targetLazy = 0;
  var startScrape = 0;
  var endScrape = 10;

  var collectedUrls = [];
  var scrapedPosts = [];

  var log = function(msg) {
    var time = new Date().toISOString();
    console.log('[' + time.substring(11, 19) + '] ' + msg);
  };

  var updateTitle = function(text) {
    document.title = text;
  };

  var getPostLinks = function() {
    var anchors = document.getElementsByTagName('a');
    var posts = [];
    var seen = {};

    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].href;
      if (href && href.indexOf('/p/') !== -1) {
        var match = href.match(/\/p\/([^\/\?#]+)/);
        if (match && !seen[match[1]]) {
          seen[match[1]] = true;
          posts.push(href);
        }
      }
    }
    return posts;
  };

  var scrollToBottom = function() {
    window.scrollTo(0, document.body.scrollHeight);
  };

  var sleep = function(ms) {
   ugs return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  };

  var extractPhones = function(text) {
    if (!text) return [];
    var phones = {};
    var patterns = [
      /(\+62|62|0)[0-9]{8,12}/g,
      /(\+62|62|0)?[0-9]{3,4}-[0-9]{4}-[0-9]{4}/g,
      /(\+62|62|0)?[0-9]{3,4}\s[0-9]{4}\s[0-9]{4}/g
    ];

    for (var p = 0; p < patterns) p++) {
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

  var extractDate = functionugs function(text) {
    if (!text) return null;
    var match = text.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  var debugPopup = function(popupWin, index) {
    return new Promise(function(resolve) {
      log('=== DEBUGGING POPUP ' + index + ' ===');
      log('Popup window exists:', !!popupWin);

      if (!popupWin) {
        log('ERROR: Popup is null/undefined!');
        resolve({success: false, debug: 'no popup'});
        return;
      }

      log('Popup.closed:', popupWin.closed);

      if (!popupWin.document) {
        log('ERROR: Popup.document is null!');
        resolve({success: false, debug: 'no document'});
        return;
      }

      if (!popupWin.document.body) {
        log('ERROR: Popup' + index + ' has no body!');
        resolve({success: false, debug: 'no body'});
        return;
      }

      log('Popup.document exists: OK');

      var scripts = popupWin.document.getElementsByTagName('script');
      log('Scripts found:', scripts.length);

      var hasInstagramData = false;
      var scriptWithText = null;

      for (var s = 0; s < scripts.length; s++) {
        var text = scripts[s] && scripts[s].textContent;
        if (text && text.length > 100) {
          var hasKeyword = text.indexOf('additional') !== -1 || text.indexOf('edge_owner_to_timeline') !== -1;
          if (hasKeyword) {
            hasInstagramData = true;
            scriptWithText = s;
            break;
          }
        }
      }

      if (!hasInstagramData) {
        log('No Instagram data found in scripts');
      }

      var bodyText = popupWin.document.body.innerText || '';
      log('Body text length:', bodyText.length);

      var bodyHTML = popupWin.document.body.innerHTML || '';
      log('Body HTML length:', bodyHTML.length);

      log('Body text has "text":', bodyText.indexOf('"text"') !== -1);
      log('Body HTML has "text":', bodyHTML.indexOf('"text"') !== -1);

      resolve({
        success: true,
        debug: 'popup OK'
      });
    });
  };

  var extractCaptionFromPopup = function(popupWin, index) {
    return new Promise(function(resolve) {
      log('Opening post ' + index + ':');

      var popup = window.open(popupWin.document.URL, '_blank', 'width=600,height=800');

      if (!popup) {
        log('ERROR: Popup blocked! Enable popups for this site.');
        resolve({success: false, caption: ''});
        return;
      }

      setTimeout(function() {
        debugPopup(popup, index).then(function(debugResult) {
          if (!debugResult.success) {
            popup.close();
            resolve({success: false, caption: '', debug: debugResult.debug});
            return;
          }

          log('Popup loaded, extracting...');

          try {
            var doc = popup.document;
            var caption = '';

            log('Popup.document:', !!doc);

            if (doc && doc.body) {
              log('Popup.document.body exists: OK');

              var scripts = doc.getElementsByTagName('script');
              log('Scripts in popup:', scripts.length);

              for (var s = 0; s < scripts.length; s++) {
                var text = scripts[s].textContent || '';

                if (text && text.length > 10000) {
                  var textMatches = text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);

                  if (textMatches && textMatches.length > 0) {
                    var longest = '';
                    var decoded;

                    for (var t = 0; t < textMatches.length; t++) {
                      var encoded = textMatches[t][1];

                      if (encoded) {
                        try {
                          decoded = JSON.parse('"' + encoded + '"');
                        } catch (e) {
                          decoded = encoded.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                        }

                        if (decoded && decoded.length > longest.length) {
                          longest = decoded;
                        }
                      }
                    }

                    if (longest && longest.length > 100) {
                      caption = longest;
                      log('Found caption (' + longest.length + ' chars)');
                    }
                  }
                }
              }
            }

            if (!caption) {
              var h1s = doc.getElementsByTagName('h1');
              for (var i = 0; i < h1s.length; i++) {
                var text = h1s[i].innerText || '';
                if (text && text.length > caption.length && text.length > 20) {
                  caption = text;
                }
              }
            }

            if (!caption) {
              var spans = doc.querySelectorAll('span[dir="auto"]');
              for (var j = 0; j < spans.length; j++) {
                var text = spans[j].innerText || '';
                if (text && text.length > caption.length) {
                  caption = text;
                }
              }
            }

            if (caption) {
              log('Using fallback methods');
            }

            log('Final caption length:', caption ? caption.length : 0);

            popup.close();
            resolve({success: caption && caption.length > 0, caption: caption || ''});

          } catch (e) {
            log('ERROR: ' + e.message);
            if (popup) {
              popup.close();
            }
            resolve({success: false, caption: '', debug: 'error: ' + e.message});
          }

        }, 4000);

      }, 4000);
    });
  };

  var runScrollPhase = function() {
    return new Promise(function(resolve) {
      log('=== SCROLL PHASE ===');
      log('Target: ' + targetLazy + ' scrolls');

      var scrollLoop = function() {
        if (lazyCount >= targetLazy) {
          log('Scroll complete! Found ' + collectedUrls.length + ' posts');
          resolve();
          return;
        }

        scrollToBottom();

        sleep(SCROLL_WAIT).then(function() {
          lazyCount++;

          var links = getPostLinks();

          for (var i = 0; i < links.length; i++) {
            var href = links[i];

            var found = false;
            for (var j = 0; j < collectedUrls.length) j++) {
              if (collectedUrls[j] === href) {
                found = true;
                break;
              }
            }

            if (!found) {
              collectedUrls.push(href);
            }
          }

          var percent = Math.round((lazyCount / targetLazy) * 100);
          var bar = '';

          for (var b = 0; b < 25; b++) {
            bar += percent / 4 > b ? '█' : '░';
          }

          updateTitle(bar + ' ' + percent + '% | ' + lazyCount + '/' + targetLazy + ' | Posts: ' + collectedUrls.length);

          if (lazyCount % 10 === 0) {
            log('Progress: ' + lazyCount + '/' + targetLazy + ' | Posts: ' + collectedUrls.length);
          }

          scrollLoop();
        });
      };

      scrollLoop();
    });
  };

  var runScrapePhase = function() {
    return new Promise(function(resolve) {
      log('=== SCRAPE PHASE ===');
      log('Range: ' + startScrape + ' to ' + endScrape);

      var urlsToScrape = [];
      for (var i = startScrape; i <= endScrape && i < collectedUrls.length; i++) {
        urlsToScrape.push(collectedUrls[i]);
      }

      log('Will scrape ' + urlsToScrape.length + ' posts');

      var scrapeLoop = function(idx) {
        if (idx >= urlsToScrape.length) {
          log('Scrape complete!');
          resolve();
          return;
        }

        var actualIndex = startScrape + idx;
        var postUrl = urlsToScrape[idx];

        updateTitle('Scraping ' + (idx + 1) + '/' + urlsToScrape.length + ' | Post ' + actualIndex);

        extractCaptionFromPopup(postUrl, actualIndex).then(function(result) {
          if (!result.success || !result.caption) {
            log('Post ' + actualIndex + ' FAILED - no caption');
          } else {
            var postData = {
              index: actualIndex,
              url: postUrl,
              scrapedAt: new Date().toISOString(),
              success: true,
              caption: result.caption,
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

            postData.hashtags = result.caption.match(/#[\w]+/g) || [];
            postData.mentions = result.caption.match(/@[\w.]+/g) || [];
            postData.phones = extractPhones(result.caption);
            postData.emails = extractEmails(result.caption);
            postData.date = extractDate(result.caption);

            scrapedPosts.push(postData);
            log('Post ' + actualIndex + ' saved');
          }

          scrapeLoop(idx + 1);
        });
      };

      scrapeLoop(0);
    });
  };

  var saveResults = function() {
    var results = {
      metadata: {
        targetUsername: window.location.href.split('/').pop(),
        lazyLoadingCount: lazyCount,
        scrapeStartIndex: startScrape,
        scrapeEndIndex: endScrape,
        totalPostsLoaded: collectedUrls.length,
        totalPostsScraped: scrapedPosts.length,
        completedAt: new Date().toISOString()
      },
      posts: scrapedPosts,
      allPostUrls: collectedUrls
    };

    try {
      localStorage.setItem('instagram_scraper_final', JSON.stringify(results));
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
      a.download = 'instagram-scraped-' + Date.now() + '.json';
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
    log('Next: Check downloaded JSON');
    log('Manual upload needed to /parsed/ folder');

    updateTitle('Instagram');
  };

  var main = function() {
    var links = getPostLinks();
    for (var i = 0; i < links.length; i++) {
      collectedUrls.push(links[i]);
    }

    log('Current posts on page: ' + links.length);

    var mode = prompt(
      'Mode:\n\n' +
      '  quick = Scrape current posts (no scroll)\n' +
      '  full = Scroll + scrape (deep scraping)\n\n' +
      'Enter: quick or full',
      'quick'
    );

    if (mode === 'quick') {
      log('');
      log('QUICK MODE: Scaping current posts');
      log('');

      var range = prompt(
        'How many posts? (0-' + (links.length - 1) + ')',
        String(Math.min(10, links.length - 1))
      );

      endScrape = parseInt(range) || Math.min(10, links.length - 1);

      runScrapePhase().then(function() {
        var results = saveResults();
        showSummary(results);
      });

    } else {
      var scrollInput = prompt(
        'How many scrolls?\n' +
        ' 100 = ~400-500 posts\n' +
        ' 200 = ~800-1000 posts\n' +
        'Enter number:',
        '200'
      );

      targetLazy = parseInt(scrollInput) || 200;

      log('');
      log('FULL MODE');
      log('Scrolls: ' + targetLazy);
      log('');

      runScrollPhase().then(function() {
        var range = prompt(
          collectedUrls.length + ' posts loaded.\n\n' +
          'Scrape range? (0-' + (collectedUrls.length - 1) + ')',
          '0-' + Math.min(50, collectedUrls.length - 1)
        );

        var rangeMatch = range.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          startScrape = parseInt(rangeMatch[1]);
          endScrape = parseInt(rangeMatch[2]);
        }

        log('');
        log('Scraping ' + startScrape + ' to ' + endScrape);

        runScrapePhase().then(function() {
          var results = saveResults();
          showSummary(results);
        });
      });
    }
  };

  console.log('\n*** IMPORTANT ***');
  console.log('This scraper opens posts in NEW WINDOWS to extract captions.');
  console.log('You may see popup windows - this is normal.');
  console.log('Please allow popups for Instagram if prompted.\n');

  main();

})();
