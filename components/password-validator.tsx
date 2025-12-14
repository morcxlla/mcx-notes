'use client'

const PasswordValidator = ({ value }: { value: string }) => {
  const lengthValid = value.length >= 5
  const numberValid = /\d/.test(value)
  const letterValid = (value.match(/[a-zA-Z]/g) || []).length >= 2
  const specialValid = /[^a-zA-Z0-9]/.test(value)

  const renderItem = (valid: boolean, text: string) => (
    <li className="text-amber-400" hidden={valid}>
      {text}
    </li>
  )

  return (
    <ul>
      {renderItem(lengthValid, 'At least 5 characters')}
      {renderItem(numberValid, 'At least 1 number')}
      {renderItem(letterValid, 'At least 1 letters')}
      {renderItem(specialValid, 'At least 1 special character')}
    </ul>
  )
}

export default PasswordValidator
