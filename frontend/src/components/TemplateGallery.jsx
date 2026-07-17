import { useMemo, useState } from "react";
import TemplateCard from "./TemplateCard";
import subtitleTemplates from "../data/subtitleTemplates";

const TEMPLATE_GROUPS = {
  All: () => true,
  Social: (template) => ["instagram-reel", "youtube-shorts"].includes(template.id),
  Cinema: (template) => ["netflix"].includes(template.id),
  Gaming: (template) => ["gaming"].includes(template.id),
  Podcast: (template) => ["podcast"].includes(template.id),
  News: (template) => ["news"].includes(template.id),
};

function TemplateGallery({ selectedTemplateId, onSelectTemplate }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const templates = useMemo(
    () =>
      [
        {
          id: "none",
          name: "None",
          fontName: "Poppins",
          fontWeight: "Regular",
          fontColor: "#ffffff",
          highlightColor: "#ffff00",
          animation: "none",
          position: "bottom",
        },
        ...Object.entries(subtitleTemplates).map(([id, template]) => ({
          id,
          name:
            id === "instagram-reel"
              ? "Instagram Reel"
              : id === "youtube-shorts"
                ? "YouTube Shorts"
                : id === "netflix"
                  ? "Netflix"
                  : id.charAt(0).toUpperCase() + id.slice(1),
          ...template,
        })),
      ],
    []
  );

  const filteredTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory = template.id === "none" || (TEMPLATE_GROUPS[activeCategory] || TEMPLATE_GROUPS.All)(template);
      const matchesSearch = !query || template.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm, templates]);

  return (
    <div className="template-gallery">
      <div className="template-gallery__toolbar">
        <input
          className="template-gallery__search"
          type="search"
          placeholder="Search templates"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <div className="template-gallery__chips">
          {Object.keys(TEMPLATE_GROUPS).map((category) => (
            <button
              key={category}
              type="button"
              className={`template-chip ${activeCategory === category ? "template-chip--active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="template-gallery__grid">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onClick={() => onSelectTemplate(template.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default TemplateGallery;
