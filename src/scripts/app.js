const startDate = new Date('2021-08-23 00:00:00'); // 替换为你和对象在一起的日期
const displayElement = document.getElementById('time-together');

function updateDateDisplay() {
    const now = new Date();
    const timeDifference = now - startDate;
    const daysTogether = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hoursTogether = Math.floor((timeDifference / (1000 * 60 * 60)) % 24);
    const minutesTogether = Math.floor((timeDifference / (1000 * 60)) % 60);
    const secondsTogether = Math.floor((timeDifference / 1000) % 60);
    displayElement.textContent = `我们在一起已经 ${daysTogether} 天 ${hoursTogether} 小时 ${minutesTogether} 分钟 ${secondsTogether} 秒了！`;
}

 document.addEventListener('DOMContentLoaded', () => {
    updateDateDisplay();
    setInterval(updateDateDisplay, 1000);
});