import "./style.css";
if (new URLSearchParams(location.search).get("mode") === "workbench") {
  void import("./workbench");
} else {
  void import("./side-scroll");
}
