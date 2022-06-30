function setHint(message, isError) {
  const hint = document.getElementById("hint");
  hint.innerText = message;
  hint.style.color = isError ? "red" : "white";
}
