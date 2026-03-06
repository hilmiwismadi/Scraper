
console.log('=== INSTAGRAM PAGE DIAGNOSTIC ===\n');

console.log('STEP 1: Check page URL');
console.log('URL:', window.location.href);

console.log('\nSTEP 2: Find ALL <a> elements');
var allAnchors = document.getElementsByTagName('a');
console.log('Total <a> elements:', allAnchors.length);

console.log('\nSTEP 3: Count /p/ links');
var pLinkCount = 0;
var pLinkSample = [];

for (var i = 0; i < allAnchors.length; i++) {
  var href = allAnchors[i].href;
  if (href && href.indexOf('/p/') !== -1) {
    pLinkCount++;
    if (pLinkSample.length < 5) {
      pLinkSample.push(href);
    }
  }
}

console.log('Found /p/ links:', pLinkCount);

if (pLinkSample.length > 0) {
  console.log('Sample links:');
  for (var j = 0; j < pLinkSample.length; j++) {
    console.log('  [' + j + ']', pLinkSample[j]);
  }
}

console.log('\nSTEP 4: Check for Instagram data in scripts');
var scripts = document.getElementsByTagName('script');
console.log('Total <script> elements:', scripts);

var dataFound = false;
var dataScriptIndex = -1;
var dataScriptLength = 0;

for (var k = 0; k < scripts.length; k++) {
  var text = scripts[k].textContent || '';
  if (text && text.length > 10000) {
    var hasAdditional = text.indexOf('additional') !== -1;
    var hasEdgeData = text.indexOf('edge_owner_to_timeline') !== -1;

    if (hasAdditional || hasEdgeData) {
      dataFound = true;
      dataScriptIndex = k;
      dataScriptLength = text.length;
      break;
    }
  }
}

if (dataFound) {
  console.log('  Instagram data found:');
  console.log('    Script index:', dataScriptIndex);
  console.log('    Content length:', dataScriptLength.toLocaleString(), 'characters');
} else {
  console.log('  Instagram data NOT found');
}

console.log('\nSTEP 5: Check article elements');
var articles = document.getElementsByTagName('article');
console.log('Found <article> elements:', articles.length);

console.log('\n=== SUMMARY ===');
console.log('Post links found:', pLinkCount);
console.log('Instagram data found:', dataFound ? 'Yes' : 'No');
console.log('Article elements:', articles.length);

if (pLinkCount === 0 && !dataFound) {
  console.log('\n*** DIAGNOSIS ***');
  console.log('No post data available on this page.');
  console.log('');
  console.log('Possible reasons:');
  console.log('1. Not on Instagram profile page');
  console.log('2. Page not fully loaded (wait longer)');
  console.log('3. Account is a private profile');
  console.log('4. Instagram changed page structure');
  console.log('');
  console.log('Try these:');
  console.log('- Wait 10 seconds and run again');
  console.log('- Scroll down a bit and run again');
  console.log('- Check browser console for errors');
}
