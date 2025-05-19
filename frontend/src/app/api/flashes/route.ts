import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const skip = searchParams.get('skip') || '0';
  const limit = searchParams.get('limit') || '10';

  try {
    const backendUrl = `http://localhost:8000/flashes/latest/?skip=${skip}&limit=${limit}`;
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // It's good practice to set a timeout for external API calls
      // cache: 'no-store', // Use this if you don't want Next.js to cache the response
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Error from backend API: ${response.status} ${response.statusText}`, errorData);
      return NextResponse.json(
        { error: `Failed to fetch flashes from backend: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching flashes in API route:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Internal Server Error while fetching flashes.', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error while fetching flashes.' }, { status: 500 });
  }
} 