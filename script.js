(function () {
  const canvas = document.getElementById("gameCanvas");
  const game = new window.PandaTD.Game(canvas);
  new window.PandaTD.UI(game);
  game.start();
})();
