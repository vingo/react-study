// 参考实现：把 useFormStatus 放进 <form> 的子组件。

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
        <SubmitButton />
      </form>
    </section>
  )
}
