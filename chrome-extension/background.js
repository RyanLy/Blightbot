function inject(fn) {
  const script = document.createElement('script');
  var actualCode = '(' + fn + ')();';
  script.text = actualCode;
  document.documentElement.appendChild(script);
}

async function loadScript() {
  const script = document.createElement('script');
  script.src = 'https://ryanly.github.io/Blightbot/blightBot.js';
  document.documentElement.appendChild(script);
}

loadScript();

// Wait for blightbot.js to load
setTimeout(function() {
  inject(function() {
    const oldLogInfo = window.logInfo;
    window.logInfo = function(msg) {
      oldLogInfo(msg);
      const logMessage = `[${new Date().toLocaleString()}] ${msg}`;
      window.postMessage(logMessage);
    };
  });
}, 2500);

window.addEventListener('message', function({ data }) {
  chrome.runtime.sendMessage(data);
});

chrome.runtime.onMessage.addListener(function(msg) {
  switch(msg) {
    case 'start':
      inject(function() {
        main();
      });
      break;
    case 'start-loop':
      inject(function() {
        main('deadman', true);
      });
      break;
    case 'pause':
      inject(function() {
        pause();
      });
      break;
    case 'resume':
      inject(function() {
        resume();
      });
      break;
    case 'restart':
      inject(function() {
        restart();
      });
      break;
    case 'exit':
      inject(function() {
        exit();
      });
      break;
  }
});
