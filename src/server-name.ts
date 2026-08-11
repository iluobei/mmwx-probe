const emojiPattern = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u

/**
 * Adds the generated region flag only when the configured server name does not
 * already contain an emoji. This avoids labels such as "🇯🇵 🇯🇵 Tokyo" while
 * keeping the original configured name untouched.
 */
export function displayServerName(
  name: string | undefined,
  fallback: string,
  generatedEmoji = '',
): string {
  const label = name?.trim() || fallback
  return generatedEmoji && !emojiPattern.test(label)
    ? `${generatedEmoji} ${label}`
    : label
}
