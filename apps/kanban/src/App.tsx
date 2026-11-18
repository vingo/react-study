import { KanbanBoard } from './components/KanbanBoard'

export default function App() {
  return (
    <main className="app">
      <KanbanBoard />
      <footer className="app-footer">
        任务保存在此浏览器的 localStorage 中，不会上传到服务器。
      </footer>
    </main>
  )
}
