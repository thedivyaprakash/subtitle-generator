import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
});

export const pollVideoStatus = async (videoId, { isDone, intervalMs = 1500 } = {}) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await api.get(`/api/upload/video/${videoId}/status`);
    if (isDone(data)) return data;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

export default api;