// Personal practice: all downloaded whole-sentence recordings are available locally.
const ACCESS={session:{local:true},selected:0,ready:Promise.resolve(),feature(){},activity(){},ensureStudy:async q=>{q.audioUrl=ORIGINAL_AUDIO[q.questionKey]||null;return true}};
