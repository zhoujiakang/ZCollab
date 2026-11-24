/** Acknowledge only the title revision included in a successful request. */
export class TitleChanges {
  revision = 0;
  private acknowledged = 0;

  markChanged() { this.revision += 1; }
  acknowledge(revision: number) { this.acknowledged = Math.max(this.acknowledged, revision); }
  get pending() { return this.revision > this.acknowledged; }
}

export function docSavePayload(title: string, titleChanged: boolean, content?: { json: unknown; text: string }) {
  const payload: { title?: string; content?: string; text?: string } = {};
  if (titleChanged) payload.title = title;
  if (content) {
    payload.content = JSON.stringify(content.json);
    payload.text = content.text;
  }
  return payload;
}
