import re

def chunk_text(content):
    """Deterministic paragraph chunks, preserving source heading and paragraph numbers."""
    chunks=[]; heading="Nội dung"; paragraph=0
    for block in re.split(r"\n\s*\n",content.replace("\r\n","\n").strip()):
        block=block.strip()
        if not block: continue
        lines=block.splitlines()
        if lines[0].startswith("#"):
            heading=lines.pop(0).lstrip("# ")[:140] or "Nội dung"
            block="\n".join(lines).strip()
        if not block: continue
        paragraph+=1
        # Do not split a source claim by overlapping unrelated sections.
        while block:
            cut=min(1200,len(block))
            if len(block)>1200:
                boundary=block.rfind(" ",600,1200)
                if boundary>0: cut=boundary
            chunks.append((f"{heading} · đoạn {paragraph}"[:180],block[:cut].strip()))
            block=block[cut:].strip()
    if not chunks or len(chunks)>32: raise ValueError("Document must contain between 1 and 32 chunks")
    return chunks
