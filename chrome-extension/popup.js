function injectCommand(command) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(
        tabs[0].id,
        command
    );
  });
}

const startButton = document.getElementById('start');
const startLoopButton = document.getElementById('start-loop');
const pauseButton = document.getElementById('pause');
const resumeButton = document.getElementById('resume');
const restartButton = document.getElementById('restart');
const exitButton = document.getElementById('exit');
const logsContainer = document.getElementById('logs-container');

startButton.onclick = () => { injectCommand('start'); };
startLoopButton.onclick = () => { injectCommand('start-loop'); };
pauseButton.onclick = () => { injectCommand('pause'); };
resumeButton.onclick = () => { injectCommand('resume'); };
restartButton.onclick = () => { injectCommand('restart'); };
exitButton.onclick = () => { injectCommand('exit'); };

chrome.runtime.onMessage.addListener(function(msg) {
  console.log(msg);
  const logLine = document.createElement('div');
  logLine.textContent = msg;
  logsContainer.append(logLine);
});

chrome.runtime.onConnect.addListener(function(port) {
  console.log('connected!');
  port.onMessage.addListener(function(msg) {
    console.log('msg');
  });
});
