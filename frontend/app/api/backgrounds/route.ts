import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

export async function GET(): Promise<NextResponse> {
  const backgroundsDirectory = path.join(process.cwd(), 'public/workspace-backgrounds');

  try {
    if (!fs.existsSync(backgroundsDirectory)) {
      return NextResponse.json([]);
    }

    const fileNames = fs.readdirSync(backgroundsDirectory);

    // Filter for image files
    const backgrounds = fileNames.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    });

    return NextResponse.json(backgrounds);
  } catch (error) {
    console.error('Failed to read backgrounds directory:', error);
    return NextResponse.json({ error: 'Failed to load backgrounds' }, { status: 500 });
  }
}
