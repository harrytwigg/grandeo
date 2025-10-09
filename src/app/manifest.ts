import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Grandeo",
		short_name: "Grandeo",
		description: "Grandeo app",
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#000000",
		icons: [
			{
				src: "/icon.png",
				sizes: "225x225",
				type: "image/png",
			},
		],
	};
}
