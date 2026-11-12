// 练习 1（改 bug，约 10 分钟）
// 现象：开发环境里三个茶杯显示的是第 2、4、6 位客人，而不是 1、2、3。
// 任务：找出原因并修复。不允许删除测试里的 <StrictMode>。

// let guest = 0

// function Cup() {
//   guest = guest + 1
//   return <h2>给第 {guest} 位客人的茶杯</h2>
// }

// export default function TeaSet() {
//   return (
//     <>
//       <Cup />
//       <Cup />
//       <Cup />
//     </>
//   )
// }

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