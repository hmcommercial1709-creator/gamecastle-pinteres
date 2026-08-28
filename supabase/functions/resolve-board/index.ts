const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { board_url, access_token } = await req.json();

    if (!board_url || !access_token) {
      return new Response(
        JSON.stringify({ error: "board_url and access_token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract username and board name from URL
    // Format: https://www.pinterest.com/username/board-name/
    const match = board_url.match(/pinterest\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Invalid Pinterest board URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const username = match[1];
    const boardName = match[2].replace(/\/$/, "");

    // List boards for the user and find the matching one
    const response = await fetch(
      `https://api.pinterest.com/v5/boards?page_size=100`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: `Pinterest API error (${response.status}): ${err}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const boards = data.items || [];

    // Find board matching the URL slug
    const matched = boards.find(
      (b: { name: string; id: string }) =>
        b.name.toLowerCase().replace(/\s+/g, "-") === boardName.toLowerCase() ||
        b.name.toLowerCase() === boardName.toLowerCase()
    );

    if (matched) {
      return new Response(
        JSON.stringify({
          success: true,
          board_id: matched.id,
          board_name: matched.name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no match by name, return all boards so user can pick
    return new Response(
      JSON.stringify({
        success: false,
        error: "Board not found in your account. Here are your available boards.",
        available_boards: boards.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })),
        username,
        searched_board: boardName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
