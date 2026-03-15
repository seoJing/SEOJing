export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem("theme-preference")||"system";var r=t;if(t==="system"){r=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.add(r)}catch(e){}})()`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
