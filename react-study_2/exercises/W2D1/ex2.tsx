// 练习 2：让提交按钮显示真实的 pending 状态（15 分钟）
// 现在点击提交后，即使保存接口还没返回，按钮也一直显示“提交”。
// 原因：useFormStatus 在渲染 <form> 的组件本身调用，它读不到这个 form 的状态。
// 要求：把读取 pending 的逻辑放进一个 form 的子组件，按钮在 pending 时禁用并显示“提交中…”。

import { useFormStatus } from 'react-dom'

type CommentFormProps = {
  saveComment?: (text: string) => Promise<void>
}

const defaultSaveComment = async (_text: string) => {}
function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? '提交中…' : '提交'}
    </button>
  )
}
export default function CommentForm({ saveComment = defaultSaveComment }: CommentFormProps) {

  return (
    <section aria-label="留言表单">
      <form
        action={async (formData: FormData) => {
          const text = String(formData.get('comment') ?? '')
          await saveComment(text)
        }}
      >
        <label>
          留言
          <textarea name="comment" />
        </label>
       <SubmitButton/>
      </form>
    </section>
  )
}
