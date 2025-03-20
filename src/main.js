const elements = {
  videoList: document.querySelector("#video-list"),
  search: document.querySelector("#search"),
  noResults: document.createElement("p"),
  loader: document.createElement("div"),
};

// Initialize the no results message
elements.noResults.className = "text-gray-500 mx-auto w-full text-center";
elements.noResults.textContent = "No videos found matching your search.";

// Initialize loader element
elements.loader.className = "w-full text-center py-4";
elements.loader.innerHTML = `<div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
  <span class="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
</div>`;

const config = {
  apiEndpoint: "https://api.freeapi.app/api/v1/public/youtube/videos",
  defaultShimmerCount: 6,
  debounceDelay: 300,
  initialPage: 1,
  perPage: 10,
  scrollThreshold: 300,
};

// State management
const state = {
  currentPage: config.initialPage,
  isLoading: false,
  hasMoreVideos: true,
  searchQuery: "",
  videos: [],
};

// Function to create shimmer HTML
function createShimmerElement() {
  return `<div class="bg-white shadow-lg border border-gray-300 rounded-lg w-80 sm:w-96 animate-pulse">
    <div>
      <div class="bg-gray-300 rounded-lg h-52"></div>
      <div class="mt-2 p-2 text-center">
        <div class="bg-gray-300 rounded w-3/4 h-4"></div>
      </div>
    </div>
  </div>`;
}

// Set loading state with shimmer effect
function setLoadingState(isLoading, isInitial = false) {
  state.isLoading = isLoading;

  if (isLoading) {
    if (isInitial) {
      elements.videoList.innerHTML = Array.from(
        { length: config.defaultShimmerCount },
        createShimmerElement
      ).join("");
    } else {
      elements.videoList.appendChild(elements.loader);
    }
  } else if (elements.videoList.contains(elements.loader)) {
    elements.videoList.removeChild(elements.loader);
  }
}

// Error handling function
function handleError(error, message = "Error fetching videos:") {
  console.error(message, error);
  elements.videoList.innerHTML = `<p class="text-red-500 text-center w-full">Failed to load videos. Please try again later.</p>`;
  state.isLoading = false;
  state.hasMoreVideos = false;
}

// Parse ISO duration string in hours, minutes, and seconds
function parseISODuration(isoString) {
  if (!isoString || typeof isoString !== "string") {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  const match = isoString.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { hours: 0, minutes: 0, seconds: 0 };
  return {
    hours: parseInt(match[1] || 0, 10),
    minutes: parseInt(match[2] || 0, 10),
    seconds: parseInt(match[3] || 0, 10),
  };
}

// Format duration in MM:SS or HH:MM:SS
function formatDuration(isoString) {
  const { hours, minutes, seconds } = parseISODuration(isoString);
  const paddedSeconds = seconds.toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}

// Fetch videos from API
async function fetchVideos(page = 1) {
  try {
    const isInitialLoad = page === 1;
    setLoadingState(true, isInitialLoad);

    const response = await fetch(
      `${config.apiEndpoint}?page=${page}&limit=${config.perPage}`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    const newVideos = result?.data?.data || [];

    if (newVideos.length < config.perPage) {
      state.hasMoreVideos = false;
    }

    return newVideos;
  } catch (error) {
    handleError(error);
    return [];
  } finally {
    setLoadingState(false);
  }
}

// Create a single video element
function createVideoElement(video) {
  if (!video?.items?.snippet) {
    console.warn("Invalid video data:", video);
    return null;
  }

  const videoElementWrapper = document.createElement("a");
  videoElementWrapper.href = `https://www.youtube.com/watch?v=${video?.items?.id}`;
  videoElementWrapper.target = "_blank";
  videoElementWrapper.dataset.title =
    video?.items?.snippet?.title?.toLowerCase() || "";
  videoElementWrapper.className = "block mb-6";

  const videoElement = document.createElement("article");
  videoElement.className =
    "video-item relative shadow-lg rounded-xl hover:scale-105 transition-transform cursor-pointer";

  const thumbnail = document.createElement("img");
  thumbnail.src = video?.items?.snippet?.thumbnails?.standard?.url || "";
  thumbnail.alt = video?.items?.snippet?.title || "Video thumbnail";
  thumbnail.className = "w-full rounded-lg";
  thumbnail.onerror = () => {
    thumbnail.src = "placeholder-image.jpg";
    thumbnail.alt = "Thumbnail unavailable";
  };

  const content = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = video?.items?.snippet?.title || "Untitled";
  title.className =
    "text-xl p-4 font-semibold text-center mt-4 text-nowrap text-ellipsis overflow-hidden";

  const duration = document.createElement("span");
  duration.textContent = formatDuration(
    video?.items?.contentDetails?.duration || "PT0M0S"
  );
  duration.className =
    "absolute bg-white bottom-32 right-2 text-gray-800 px-2 py-1 rounded-md text-sm";

  const metaInfo = document.createElement("div");
  metaInfo.className = "flex justify-center items-center gap-3 p-2";

  const views = document.createElement("span");
  const likes = document.createElement("span");
  const comments = document.createElement("span");

  views.textContent = `${video?.items?.statistics?.viewCount ?? 0} views`;
  likes.textContent = `${video?.items?.statistics?.likeCount ?? 0} likes`;
  comments.textContent = `${
    video?.items?.statistics?.commentCount ?? 0
  } comments`;

  metaInfo.append(views, likes, comments);
  content.append(title, metaInfo);
  videoElement.append(thumbnail, content, duration);
  videoElementWrapper.append(videoElement);

  return videoElementWrapper;
}

// Render videos to the DOM
function renderVideos(videos, append = false) {
  if (!append) {
    elements.videoList.innerHTML = "";
  }

  if (!videos || videos.length === 0) {
    if (!append) {
      elements.videoList.innerHTML =
        "<p class='text-gray-500 text-center w-full'>No videos found.</p>";
    }
    return;
  }

  const fragment = document.createDocumentFragment();

  videos.forEach((video) => {
    const videoElement = createVideoElement(video);
    if (videoElement) {
      fragment.append(videoElement);
    }
  });

  elements.videoList.append(fragment);
}

// Debounce function
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// Handle infinite scroll
function handleScroll() {
  if (state.isLoading || !state.hasMoreVideos) return;

  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight - config.scrollThreshold) {
    loadMoreVideos();
  }
}

// Load more videos
async function loadMoreVideos() {
  if (state.isLoading || !state.hasMoreVideos) return;

  state.currentPage++;
  const newVideos = await fetchVideos(state.currentPage);

  if (newVideos.length > 0) {
    state.videos = [...state.videos, ...newVideos];
    renderVideos(newVideos, true);

    if (state.searchQuery) {
      filterVideos(state.searchQuery);
    }
  }
}

// Filter videos by search query
function filterVideos(query) {
  state.searchQuery = query;
  let visibleCount = 0;

  Array.from(elements.videoList.children).forEach((videoElement) => {
    if (videoElement.tagName.toLowerCase() === "a") {
      const title = videoElement.dataset.title || "";
      const isVisible = title.includes(query);

      videoElement.style.display = isVisible ? "block" : "none";
      if (isVisible) visibleCount++;
    }
  });

  if (visibleCount === 0 && query !== "") {
    if (!elements.videoList.contains(elements.noResults)) {
      elements.videoList.append(elements.noResults);
    }
  } else {
    if (elements.videoList.contains(elements.noResults)) {
      elements.videoList.removeChild(elements.noResults);
    }
  }
}

// Search videos function
function searchVideos(event) {
  const query = event.target.value.toLowerCase().trim();
  filterVideos(query);
}

// Initialize application
async function initializeApp() {
  try {
    elements.search.addEventListener(
      "input",
      debounce((event) => {
        searchVideos(event);
      }, config.debounceDelay)
    );

    window.addEventListener("scroll", debounce(handleScroll, 100));

    const initialVideos = await fetchVideos(state.currentPage);
    state.videos = initialVideos;
    renderVideos(initialVideos);
  } catch (error) {
    handleError(error, "Failed to initialize application:");
  }
}

// Start the application when DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);
