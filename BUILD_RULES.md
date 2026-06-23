# 建造铁律 · 底部可点元素(根治"按钮点不了/戳十几次")
任何贴近屏幕底部的可点元素(按钮/提交键/屏尾主操作),必须满足:
- 用统一安全底座类 .safe-action:sticky 钉底 + box-shadow + padding 底
  = calc(12px + env(safe-area-inset-bottom));其内 button 的 min-height:48px。
- 按钮组容器做 flex 列:header / 可滚 body / .safe-action 钉底。
- iframe 内容底边永远停在所有固定底栏(mock 条 / tabbar)之上:
  #xdSlot 底 = min(所有 position:fixed;bottom:0 的条的顶边),
  并在 mockbar 显示后 / resize / orientationchange 重算;
  CSS 给兜底 bottom:calc(var(--barsH)+env(safe-area-inset-bottom))。
- 没有 .safe-action(或等效安全间隙)的底部按钮,不准合并。
合并前必检:真机看最底那个可点元素整条在底栏之上、离底边有缓冲、一次点中(横竖屏各一次)。
