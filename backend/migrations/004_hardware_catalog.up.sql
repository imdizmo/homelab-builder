-- Hardware components catalog
CREATE TABLE hardware_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(255) NOT NULL,
    spec JSONB NOT NULL DEFAULT '{}',
    price_est FLOAT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    buy_urls JSONB DEFAULT '[]',
    image_url TEXT DEFAULT '',
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved BOOLEAN DEFAULT true,
    likes INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hardware reviews
CREATE TABLE hardware_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES hardware_components(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    body TEXT DEFAULT '',
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hardware_components_category ON hardware_components(category);
CREATE INDEX idx_hardware_components_brand ON hardware_components(brand);
CREATE INDEX idx_hardware_components_approved ON hardware_components(approved);
CREATE INDEX idx_hardware_reviews_component_id ON hardware_reviews(component_id);
