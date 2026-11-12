// 修复思路：渲染期间不修改模块变量，把"第几位客人"作为 props 传入。
// 组件的输出只取决于 props，调用几次结果都一样。

function Cup({ guest }: { guest: number }) {
  return <h2>给第 {guest} 位客人的茶杯</h2>
}

export default function TeaSet() {
  return (
    <>
      <Cup guest={1} />
      <Cup guest={2} />
      <Cup guest={3} />
    </>
  )
}
